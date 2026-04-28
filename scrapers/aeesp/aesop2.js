

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))
const UserAgent = require("user-agents");
//const {extractContactInfo} = require ('../../utils/email_link_extractor.js')
const {extractContactInfo} = require ('./utils/aesop_email_link_extractor');
const {extractDeadlineData} = require ('./utils/aesop_deadline_extractor');
/**<---------utilities------------>**/
function clearPostDocTitle(text) {
  const patternsToRemove = [
      "Postdoctoral Fellow - ",
      "Postdoctoral Research Fellow Position in",
      "Postdoctoral fellowship on",
      "Postdoc in",
      "Post Associate in",
      "Postdoctoral Research Associate",
      "Postdoctoral Research Associate "
  ];

  let cleanedText = text;

  for (const pattern of patternsToRemove) {
      cleanedText = cleanedText.replace(new RegExp(pattern, 'g'), '');
  }

  return cleanedText.trim();
}

function hasAnyPattern(text) {
  const patternsToCheck = [
      "Postdoctoral Fellow - ",
      "Postdoctoral Research Fellow Position in",
      "Postdoctoral fellowship on",
      "Postdoc in",
      "Post Associate in",
      "Postdoctoral Research Associate",
      "Postdoctoral Research Associate "
  ];

  return patternsToCheck.some(pattern => text.includes(pattern));
}

function getCurrentDate() {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

function cleanPhdTitle(text) {
  const phdPatternsToRemove = [
    "PhD in ",
    "Ph.D. in ",
    "Ph.D. Assistantship in ",
    "Fully-funded Ph.D. Student Position in ",
    "Fully Funded Ph.D. Position in "
  ];

  let cleanedText = text;
  for (const pattern of phdPatternsToRemove) {
    cleanedText = cleanedText.replace(new RegExp(pattern, 'gi'), '');
  }
  return cleanedText.trim();
}

function toTitleCase(str) {
  // List of words that typically remain lowercase in titles (except first and last word)
  const lowercaseWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'if', 'in', 'into', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'with', 'via', 'vs'];

  return str.toLowerCase().split(' ').map((word, index, array) => {
    // First and last word always capitalized
    if (index === 0 || index === array.length - 1) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    // Check if word should remain lowercase
    if (lowercaseWords.includes(word)) {
      return word;
    }
    // Capitalize other words
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// NEW: Extract focus area from post body
function extractFocusArea(post_body, originalTitle) {
  if (!post_body) return null;

  // Check if title contains "Ph.D. student -" or "PhD student -"
  if (originalTitle.includes("Ph.D. student -") || originalTitle.includes("PhD student -")) {
    // Look for "focus on" pattern
    const focusPattern = /focus\s+on\s+([^.]+\.)/i;
    const match = post_body.match(focusPattern);

    if (match && match[1]) {
      let focusArea = match[1].trim();
      focusArea = focusArea.replace(/[.!?]+$/, '');
      focusArea = toTitleCase(focusArea);
      return focusArea;
    }
  }
  return null;
}

// NEW: Process post title with both operations
function processPostTitle(post_title, post_body) {
  // First operation: Remove PhD patterns
  let processedTitle = cleanPhdTitle(post_title);

  // Second operation: Handle "Ph.D. student -" pattern
  if (post_title.includes("Ph.D. student -") || post_title.includes("PhD student -")) {
    const focusArea = extractFocusArea(post_body, post_title);
    if (focusArea) {
      processedTitle = focusArea;
    } else {
      // Return original title if no focus area found
      processedTitle = post_title;
    }
  }

  return processedTitle.trim();
}


async function scrapeJobsFromPage(page, url) {
  console.log(`\n🌐 Navigating to: ${url}`);
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector(".view-content", {
    visible: true,
    timeout: 0,
  });

  let post_links = await page.evaluate(() => {
    let jobListingElements = document.querySelectorAll("h3>a");
    let extractedLinks = [];

    jobListingElements.forEach((link) => {
      if (link.href) {
        extractedLinks.push(link.href);
      }
    });

    return extractedLinks;
  });

  let post_cats = await page.evaluate(() => {
    let categories = document.querySelectorAll(".views-row");
    let extracted_categories = [];

    categories.forEach((dt) => {
      if (dt) {
        extracted_categories.push(dt.textContent);
      }
    });

    extracted_categories = extracted_categories.map(d => {
      let p_arr = d.split(':');
      return p_arr[1].trim();
    });
    return extracted_categories;
  });

  let post_block = [];
  for (let i = 0; i < post_links.length; i++) {
    post_block.push({
      postcategory: post_cats[i],
      postlink: post_links[i]
    });
  }

  return post_block;
}

/**<---------utilities-end------------>**/

/**<-------program-codes-------->**/
async function scrap_predoc () {


    let browser;
    browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--single-process',
    ],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });


  let page;

  try {
    page = await browser.newPage();
    // remove timeout limit
    page.setDefaultNavigationTimeout(0);

    // Block images, stylesheets, and fonts to save memory and bandwidth
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    let userAgent = new UserAgent({ deviceCategory: "mobile" }); //desktop
    let randomAgent = userAgent.toString();
    await page.setUserAgent(randomAgent);

    let allPostBlocks = [];

    // Define pages to scrape
    const pagesToScrape = [
      "https://aeesp.org/jobs",           // Page 0
      "https://aeesp.org/jobs?page=1"     // Page 1
    ];

    // Scrape each page
    for (let pageIndex = 0; pageIndex < pagesToScrape.length; pageIndex++) {
      const pageUrl = pagesToScrape[pageIndex];
      console.log(`\n📄 Scraping page ${pageIndex + 1}/${pagesToScrape.length}: ${pageUrl}`);

      const postsFromPage = await scrapeJobsFromPage(page, pageUrl);
      console.log(`✅ Found ${postsFromPage.length} posts on page ${pageIndex + 1}`);

      allPostBlocks.push(...postsFromPage);
    }

    console.log(`\n📊 Total posts collected from all pages: ${allPostBlocks.length}`);

    function filterOutFaculty(postBlocks) {
      return postBlocks.filter(block => {
        const category = block.postcategory?.toLowerCase() || '';
        return category !== 'faculty' && category !== 'undergraduate';
      });
    }

    let filteredPosts = filterOutFaculty(allPostBlocks);
    console.log(`Filtered posts count (after removing faculty/undergrad): ${filteredPosts.length}`);

    filteredPosts = filteredPosts.slice(0, 10);
    console.log(`Reduced filtered posts count (limit 10): ${filteredPosts.length}`);
    //also scrap link "https://aeesp.org/jobs?page=1" and merge second scrap posts with filteredPosts from first scrap
    let postsDetailsArr = [];



    async function extractPostDetails (extract1) {
      //extraction of post details in second page from the post primary link scrapped from first page
      let postL = extract1.postlink;
      console.log(`post link: ${postL}`);
      await page.goto(`${postL}`, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForSelector(".field__label", {
        visible: true,
        timeout: 0,
      });

      //program title; eg.phd position in environmental science

      let post_title = await page.evaluate(() => {
        const element = document.querySelector('.field--name-title');
        return element ? element.textContent : null;
      });

      if (hasAnyPattern(post_title)) {
        console.log("post-title contains post-doc pattern");
        post_title = clearPostDocTitle(post_title);
    };


      let post_position = await page.evaluate(() => {
        const element = document.querySelector('.field--name-field-job-type');
        return element ? element.textContent : null;
      }); post_position = post_position.split('\n')[2].trim();

      if (post_position == 'Graduate') {post_position = 'PHD POSITION'};
      //console.log(post_label)
      let post_Inst = await page.evaluate(() => {
        const element = document.querySelector('.field--name-field-job-institution');
        return element ? element.textContent : null;
      }); post_Inst = post_Inst.split('\n')[2].trim();

      //if body does not contain phd for posts with position of graduate/phd skip to next post

      let post_body = await page.evaluate(() => {
        const element = document.querySelector('.field--name-body');
        return element ? element.textContent : null;
      });

      if(post_position==="PHD POSITION" && !post_body.includes('Ph.D.')) {return}  //skip to next array element
      const contactInfo = extractContactInfo(post_body);
      const post_deadline = extractDeadlineData(post_body);

      if(post_deadline==="expired deadline") {return} //skip to next array element

      post_title = processPostTitle(post_title, post_body);

      //check for phdTitlePattern here; replace PhD with empty string etc..

      let data = {
        position: post_position,
        study_area: post_title,
        institution: post_Inst,
        contact_email: contactInfo.email,
        application_link: contactInfo.link,
        application_deadline: post_deadline,     //rolling posts deleted at the end of the scrap year
        postLink: postL,
        scrap_date: getCurrentDate()
      };

      //console.log (data);
      postsDetailsArr.push(data);

    };

    //iterator to extract post details from filteredPosts array using the extractPostDetails function
    //await extractPostDetails(extract1);

    // Simple and reliable sequential processing
    for (let i = 0; i < filteredPosts.length; i++) {
      const post = filteredPosts[i];
      console.log(`\n📌 Processing post ${i + 1}/${filteredPosts.length}: ${post.postlink}`);

      try {
        await extractPostDetails(post);
        console.log(`✅ Post ${i + 1} extracted successfully`);
      } catch (err) {
        console.error(`❌ Failed to extract post ${i + 1}:`, err.message);
      }

      // Wait 1-2 seconds between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n🎉 Extraction complete! Total posts: ${postsDetailsArr.length}`);
    console.log("post details array: \n", postsDetailsArr);
    await page.close();
    await browser.close();
    console.log('returning to outer cron scope?...')
    return;


  } catch (error) {
    console.error(error);
  }
}

//console.profile();
scrap_predoc();
//module.exports = {scrapJobs}
