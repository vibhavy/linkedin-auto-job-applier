require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const allowedEasyApplyCount = process.env.MAX_EASY_APPLY_COUNT ?? 5;
const allowedMaxScrollAttempts = process.env.MAX_SCROLL_ATTEMPTS ?? 10;

puppeteer.use(StealthPlugin());

(async () => {
  let browser;
  let closeBrowserAfterCompletion = true;

  // Connect to an existing browser if a WebSocket endpoint is provided
  if (process.env.BROWSER_WS_ENDPOINT) {
    try {
      browser = await puppeteer.connect({ browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT });
      closeBrowserAfterCompletion = false;
      console.log("🔗 Connected to the existing browser instance.");
    } catch (error) {
      console.error("❌ Error connecting to existing browser. Launching a new browser instance.", error);
      browser = await puppeteer.launch({ headless: false });
    }
  } else {
    browser = await puppeteer.launch({ headless: false });
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Check login status and log in if necessary.
  console.log("🔍 Checking login status...");
  await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  let isLoggedIn = false;
  try {
    await page.waitForSelector('.global-nav__me-photo', { timeout: 5000 });
    isLoggedIn = true;
    console.log("✅ Already logged in!");
  } catch (error) {
    console.log("❌ Not logged in. Proceeding to login...");
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.type('#username', process.env.LINKEDIN_EMAIL, { delay: 200 });
    await page.type('#password', process.env.LINKEDIN_PASSWORD, { delay: 200 });
    await page.click('[type="submit"]');
    try {
      await page.waitForSelector('.global-nav__me-photo', { timeout: 10000 });
      isLoggedIn = true;
      console.log("✅ Logged in successfully!");
    } catch (error) {
      console.error("❌ Login failed! Check your credentials or if bot detection is active.");
      if (closeBrowserAfterCompletion) await browser.close();
      process.exit(1);
    }
  }

  // Give some time after login to avoid bot detection.
  await delay(3000);

  const jobSearchURL = "https://www.linkedin.com/jobs/search/?keywords=node%20js";
  console.log("🔎 Navigating to job search page...");
  await page.goto(jobSearchURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log("🔍 Searching for jobs...");

  let applicationsCount = 0; // Total Easy Apply applications submitted
  let easyApplyCount = 0;    // Count of Easy Apply jobs processed
  let processedIndexes = new Set();
  let scrollAttempts = 0;
  const maxScrollAttempts = allowedMaxScrollAttempts; 

  // Keep looking for job cards until we process the allowed number of Easy Apply jobs or reach max scroll attempts.
  while (easyApplyCount < allowedEasyApplyCount && scrollAttempts < maxScrollAttempts) {
    const jobListings = await page.$$('.job-card-container');
    let foundNewJob = false;

    for (let i = 0; i < jobListings.length && easyApplyCount < allowedEasyApplyCount; i++) {
      if (processedIndexes.has(i)) continue; // Skip already processed job cards.
      processedIndexes.add(i);

      // Check if the job card displays "Easy Apply"
      const hasEasyApply = await page.evaluate(el => el.innerText.includes("Easy Apply"), jobListings[i]);
      if (!hasEasyApply) {
        console.log(`⚠️ Job card ${i + 1} does not have "Easy Apply". Skipping...`);
        continue;
      }

      foundNewJob = true;
      easyApplyCount++;
      console.log(`➡️ Processing Easy Apply job #${easyApplyCount} (job card index ${i + 1})...`);
      await jobListings[i].click();
      await delay(3000);

      // Look for the Easy Apply button on the details panel.
      const easyApplyButton = await page.$('.jobs-apply-button');
      if (easyApplyButton) {
        console.log("✅ Easy Apply button found! Attempting to apply...");
        await easyApplyButton.click();
        applicationsCount++;
        await delay(2000);

        // Check if any required fields are empty; if so, close modal and skip.
        const hasEmptyFields = await checkForEmptyFields(page);
        if (hasEmptyFields) {
          console.log("⚠️ Required fields missing! Closing modal and skipping this job...");
          await closeEasyApplyModal(page);
          continue;
        }

        // Auto-fill application questions.
        await autoFillApplication(page);

        // Support multi-step applications.
        while (true) {
          const submitButton = await page.$('button[aria-label="Submit application"]');
          if (submitButton) {
            await submitButton.click();
            console.log("✅ Successfully applied!");
            await delay(2000);
            break;
          }
          
          // Check for a Review button.
          let reviewButton = null;
          try {
            reviewButton = await waitForXPathAlternative(page, "//button[contains(., 'Review')]", 2000);
          } catch (error) {
            // Not found; proceed.
          }
          if (reviewButton) {
            await reviewButton.click();
            console.log("➡️ Clicked Review button.");
            await delay(2000);
            await autoFillApplication(page);
            continue;
          }
          
          // Check for Next or Continue.
          let nextButton;
          try {
            nextButton = await waitForXPathAlternative(page, "//button[contains(., 'Next') or contains(., 'Continue')]", 5000);
          } catch (error) {
            console.log("⚠️ Next button not found (timeout), skipping this application...", error);
            break;
          }
          if (nextButton) {
            await nextButton.click();
            console.log("➡️ Clicked Next button.");
            await delay(2000);
            await autoFillApplication(page);
          } else {
            console.log("⚠️ Next button not found, skipping this application...");
            break;
          }
        }
      } else {
        console.log("⚠️ No 'Easy Apply' button found on job details. Skipping...");
      }
    } // end for-loop

    if (easyApplyCount < allowedEasyApplyCount) {
      if (!foundNewJob) {
        console.log("No new Easy Apply jobs found in the current view. Scrolling down...");
      } else {
        console.log("Scrolling down for more jobs...");
      }
      await autoScroll(page);
      await delay(2000);
      scrollAttempts++;
    }
  }

  console.log(`🚀 Job applications completed. Total 'Easy Apply' clicks: ${applicationsCount}`);
  if (closeBrowserAfterCompletion) await browser.close();
})();

// --- Helper Functions ---

// delay: returns a promise that resolves after the specified milliseconds.
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// autoScroll: attempts to scroll the container that holds job cards.
// It looks for the first job card and then finds its nearest scrollable ancestor.
// If none is found, it scrolls the window.
async function autoScroll(page) {
  await page.evaluate(() => {
    const jobCard = document.querySelector('.job-card-container');
    if (!jobCard) {
      window.scrollBy(0, window.innerHeight);
      return;
    }
    let container = jobCard.parentElement;
    while (container) {
      const style = window.getComputedStyle(container);
      const overflowY = style.getPropertyValue('overflow-y');
      if (overflowY === 'auto' || overflowY === 'scroll') {
        container.scrollBy(0, container.clientHeight);
        return;
      }
      container = container.parentElement;
    }
    // Fallback: scroll the window.
    window.scrollBy(0, window.innerHeight);
  });
}

// waitForXPathAlternative: polls the page for an element matching the given XPath until timeout.
async function waitForXPathAlternative(page, xpath, timeout = 5000) {
  const pollingInterval = 500;
  const maxTries = Math.ceil(timeout / pollingInterval);
  for (let i = 0; i < maxTries; i++) {
    const handle = await page.evaluateHandle((xp) => {
      return document.evaluate(
        xp,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
    }, xpath);
    const element = handle.asElement();
    if (element) return element;
    await delay(pollingInterval);
  }
  throw new Error("Timeout waiting for XPath: " + xpath);
}

// autoFillApplication: attempts to auto-fill application fields (e.g., clicking "Yes" for yes/no questions and selecting a resume).
async function autoFillApplication(page) {
  console.log("📝 Auto-filling application form...");
  const yesNoQuestions = await page.$$('input[type="radio"]');
  for (let question of yesNoQuestions) {
    try {
      const label = await question.evaluate(el => el.getAttribute('value'));
      if (label && label.toLowerCase() === "yes") {
        await question.click();
        console.log("✔ Marked 'Yes' for a question.");
      }
    } catch (error) {
      console.error("⚠️ Couldn't mark 'Yes'.", error);
    }
  }
  const resumeDropdown = await page.$('select[name="resume-picker"]');
  if (resumeDropdown) {
    console.log("📄 Using the most recent resume.");
    await resumeDropdown.select('0');
  }
  await delay(2000);
}

// checkForEmptyFields: returns true if any required input field is empty.
async function checkForEmptyFields(page) {
  const emptyFields = await page.$$eval('input[required]', inputs =>
    inputs.filter(input => !input.value.trim()).length
  );
  return emptyFields > 0;
}

// closeEasyApplyModal: clicks "Cancel" then "Dismiss" to close the application modal.
async function closeEasyApplyModal(page) {
  try {
    const cancelButton = await page.$('button[aria-label="Cancel"]');
    if (cancelButton) {
      await cancelButton.click();
      console.log("❌ 'Cancel' button clicked.");
      await delay(2000);
    } else {
      console.log("⚠️ 'Cancel' button not found.");
    }
    const dismissButton = await page.$('button[aria-label="Dismiss"]');
    if (dismissButton) {
      await dismissButton.click();
      console.log("❌ 'Dismiss' button clicked, modal closed.");
      await delay(2000);
    } else {
      console.log("⚠️ 'Dismiss' button not found.");
    }
  } catch (error) {
    console.error("❌ Error closing modal:", error);
  }
}
