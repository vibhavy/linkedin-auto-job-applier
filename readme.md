# LinkedIn Auto Job Applier

This project automates applying for jobs on LinkedIn using the **Easy Apply** feature. It uses [Puppeteer Extra](https://github.com/berstend/puppeteer-extra) with the Stealth plugin to reduce bot detection and supports multi‑step applications by automatically clicking through **Review**, **Next/Continue**, and **Submit** buttons.

## Features

- **Automatic Login:**  
  Logs into LinkedIn automatically using your credentials.

- **Job Filtering:**  
  Scans job listings and processes only those that include an "Easy Apply" badge.

- **Auto-Scrolling:**  
  Scrolls the job listings container (or the window) to load more jobs if fewer than the desired number are available.

- **Multi-Step Application Support:**  
  Handles multi‑step applications by automatically clicking **Review**, **Next/Continue**, and **Submit** buttons.

- **Auto-Filling:**  
  Attempts to auto-fill application fields (e.g., marking yes/no questions and selecting your resume).

- **Configurable & Remote Browser Support:**  
  Configure the maximum number of applications and scroll attempts via environment variables. Optionally, connect to an already running browser instance using the `BROWSER_WS_ENDPOINT` environment variable.

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v12 or later recommended)
- npm (comes with Node.js)
- A LinkedIn account with valid credentials

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/vibhavy/linkedin-auto-job-applier.git
   cd linkedin-auto-job-applier


2. **Install dependencies:**

    ```bash
    npm install

3. **Create a .env file in the root directory of the project and add your environment variables (see below):**

    ```bash
    # LinkedIn Credentials
    LINKEDIN_EMAIL=your.email@example.com
    LINKEDIN_PASSWORD=yourLinkedInPassword
    SKILL_SET=nodejs

    # Job Filter URL (Optional) - If not required comment it out by #
    # This is the URL of the LinkedIn job search page with your desired filters applied.
    # You can customize this URL by applying filters on LinkedIn and copying the resulting URL.
    JOB_FILTER_URL=https://www.linkedin.com/jobs/search/?currentJobId=4120693189&f_AL=true&f_E=3%2C4&f_JT=F&f_T=9%2C39%2C25170%2C25194%2C24&geoId=101452733&keywords=Nodejs&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true&sortBy=R

    # Optional: Connect to an existing browser instance with remote debugging enabled.
    # Launch Chrome with: chrome --remote-debugging-port=9222
    # Then retrieve the WebSocket endpoint from http://localhost:9222/json/version
    BROWSER_WS_ENDPOINT=ws://127.0.0.1:9222/devtools/browser/unique-id

    # Optional: Maximum number of Easy Apply applications to process (default is 5)
    MAX_EASY_APPLY_COUNT=5

    # Optional: Maximum number of scroll attempts to load additional job cards (default is 10)
    MAX_SCROLL_ATTEMPTS=10

    # Optional: Cron expression for scheduling the job application task (default is None)
    CRON_EXPRESSION=None

***Note::***

**To use BROWSER_WS_ENDPOINT, you must launch your browser with remote debugging enabled. For example:**

**macOS:**

    ```bash
    open -a "Google Chrome" --args --remote-debugging-port=9222

**Windows:**

    ```bash
    "C:\Program Files\Google Chrome\Application\chrome.exe" --remote-debugging-port=9222

**Linux:**

    ```bash
    google-chrome --remote-debugging-port=9222

**Usage**

**Run the script using Node.js:**

    ```bash 
    node index.js

**The script will:**

1. **Login & Navigation:**
Log in to LinkedIn (if not already logged in) and navigate to the job search page for "node js" jobs.

2. **Job Processing:**

Scan through job listings, processing only those that include the "Easy Apply" badge. If fewer than the desired number of jobs are loaded, the script will scroll down to load more job cards.

3. **Application Automation:**

Automatically click the Easy Apply button, fill in application fields, and handle multi‑step forms (clicking Review, Next/Continue, and Submit buttons).

4. **Remote Browser Connection:**

If BROWSER_WS_ENDPOINT is provided, the script will connect to that existing browser session instead of launching a new instance.

**How It Works**

1. **Login & Navigation:**

The script navigates to LinkedIn and logs in using your credentials if necessary. It then proceeds to the job search page.

2. **Job Filtering & Auto-Scroll:**

It gathers job cards and filters out those that do not display "Easy Apply". If not enough jobs are loaded, the script will scroll the job container (or window) to load additional job cards.

3. **Application Automation:** 

For each Easy Apply job found, the script clicks the job card, clicks the Easy Apply button, auto-fills any required fields, and supports multi‑step applications.

4. **Remote Browser Connection:**

If BROWSER_WS_ENDPOINT is specified, the script will attempt to connect to the provided WebSocket endpoint. This is useful if you wish to reuse an already running browser session (for example, for debugging).

**Troubleshooting**

Infinite Scrolling / No New Jobs:
If the script appears to scroll indefinitely without loading new jobs, verify that the selectors for the job cards haven't changed. Adjust the auto-scroll function if necessary.

**Login Issues:**

Ensure your LinkedIn credentials are correct and that LinkedIn is not blocking automated logins. Running in non‑headless mode may help debug login issues.

**Remote Debugging:**

If using BROWSER_WS_ENDPOINT, confirm that your browser was launched with remote debugging enabled and that you have copied the correct WebSocket URL.

**License**

This project is licensed under the MIT License.
