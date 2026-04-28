

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))
const UserAgent = require("user-agents");

{/**UTILITIES START */}
function trimInst(text) {
  if (!text) return '';

  // Remove whitespace, newlines, and extra spaces
  let cleaned = text
    .replace(/[\n\r\t]+/g, ' ')  // Replace newlines/tabs with space
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .replace(/^\s+|\s+$/g, '')    // Trim start and end
    .replace(/\s*-\s*/g, ' - ')   // Clean up hyphens with spaces
    .replace(/\s+/g, ' ')         // Final space cleanup
    .trim();

  return cleaned;
};

function cleanPhdTitle(text) {
  const phdPatternsToRemove = [
    "Phd Studentship:",
    "PhD Studentship -",
    ", PhD \\(Funded\\)",     // Escape parentheses and match comma
    "PhD \\(Funded\\)",        // Also match without comma
    ", PhD \\(Funded\\)$",     // Match at end of string
    "\\s*,\\s*PhD \\(Funded\\)" // Match with flexible whitespace
  ];

  let cleanedText = text;
  for (const pattern of phdPatternsToRemove) {
    cleanedText = cleanedText.replace(new RegExp(pattern, 'gi'), '');
  }
  return cleanedText.trim();
};

function getValidDeadline(deadlineString) {
  if (!deadlineString || deadlineString.trim() === '') {
    return null;
  }

  let cleaned = deadlineString.trim();
  cleaned = cleaned.replace(/(\d+)(?:st|nd|rd|th)/gi, '$1');

  let parsedDate = new Date(cleaned);

  if (isNaN(parsedDate.getTime())) {
    // Try UK format: DD Month YYYY
    const months = {
      'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
      'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5, 'july': 6, 'jul': 6,
      'august': 7, 'aug': 7, 'september': 8, 'sep': 8, 'sept': 8, 'october': 9,
      'oct': 9, 'november': 10, 'nov': 10, 'december': 11, 'dec': 11
    };

    const dateMatch = cleaned.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const monthName = dateMatch[2].toLowerCase();
      const year = parseInt(dateMatch[3], 10);
      const month = months[monthName];

      if (month !== undefined && day >= 1 && day <= 31) {
        parsedDate = new Date(year, month, day);
      }
    }
  }

  if (isNaN(parsedDate.getTime())) {
    return null;
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  return parsedDate >= currentDate ? parsedDate : null;
};


{/**UTILITIES eND */}

async function get_jobs_ac_data () {


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

    /*await page.goto("https://www.jobs.ac.uk/search/?academicDisciplineFacet[0]=psychology&academicDisciplineFacet[1]=physical-and-environmental-sciences&subDisciplineFacet[0]=geography&academicDisciplineFacet[2]=mathematics-and-statistics&subDisciplineFacet[1]=mathematics&subDisciplineFacet[2]=statistics&academicDisciplineFacet[3]=computer-sciences&subDisciplineFacet[3]=computer-science&subDisciplineFacet[4]=information-systems&subDisciplineFacet[5]=artificial-intelligence&subDisciplineFacet[6]=cyber-security&academicDisciplineFacet[4]=engineering-and-technology&subDisciplineFacet[7]=other-engineering&academicDisciplineFacet[5]=architecture-building-and-planning&subDisciplineFacet[8]=urban-and-rural-planning&academicDisciplineFacet[6]=economics&academicDisciplineFacet[7]=social-sciences-and-social-care&subDisciplineFacet[9]=sociology&subDisciplineFacet[10]=social-policy&subDisciplineFacet[11]=human-and-social-geography&academicDisciplineFacet[8]=information-management-and-librarianship&subDisciplineFacet[12]=information-science&jobTypeFacet[0]=phds&expired-job-redirect=true", {
      waitUntil: "domcontentloaded",
    });

    await page.waitForSelector("#job-listings", {
      visible: true,
      timeout: 0,
    });


    let links = await page.evaluate(() => {
      let jobListingElements = document.querySelectorAll(".j-search-result__text>a");
      let extractedLinks = [];

      jobListingElements.forEach((link) => {
        if (link.href) {
          extractedLinks.push(link.href);
        }
      });

      return extractedLinks;
    });

    //links = links.slice(0, 10); //limit to first 10 links for testing


    if (links.length > 0) {
        console.log(`total links: ${links.length}`)
    } else {
      console.log('no data to scrap');
      return;
    }

    //scrapper for the second page; extract the next page link from this selector : "j-search-content__pagination--control>a"; log the next-page link to the console; navigate to the next page using page.goto; extract the links and merge the extracted links with the links from the first page scrap
    //merge both links from the first and second page scrap here
    const linksToProcess = links.slice(0, 10); // Or links.slice(0, 10) for testing
    let postsDetailsArr = [];*/

    //ALT PAGES EXTRACTION
    async function extractPostDetails (postLink) {
      //extraction of post details in second page from the post primary link scrapped from first page
      console.log(`post link: ${postLink}`);
      await page.goto(`${postLink}`, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForSelector(".j-header", {
        visible: true,
        timeout: 0,
      });

      let post_title, post_position, post_Inst, app_link, post_deadline;

        post_title = await page.evaluate(() => {
            const element = document.querySelector('.enhanced-header > h1');
            return element ? element.textContent : null;
          });
          //post_title = cleanPhdTitle(post_title);


        post_position = await page.evaluate(() => {
            const element = document.querySelector('body > div.grid.grid__1-col > div.sub-grid > div.sub-grid.sub-grid__2-col.sub-grid__2-col--large-left.sub-grid--variable-height > div.j-enhanced__details-box > div > div.j-advert-details__container > div > table > tbody > tr:nth-child(1) > td');
            return element ? element.textContent : null;
          });



        post_Inst = await page.evaluate(() => {
            const element = document.querySelector('body > div.grid.grid__1-col > div.sub-grid > div.enhanced-header > h3');
            return element ? element.textContent : null;
          });

        post_Inst = trimInst(post_Inst);


        app_link = await page.evaluate(() => {
            const element = document.querySelector('.row-7 > a');
            return element ? element.href : null;
          });



            post_deadline = await page.evaluate(() => {
            const element = document.querySelector('body > div.grid.grid__1-col > div.sub-grid > div.sub-grid.sub-grid__2-col.sub-grid__2-col--large-left.sub-grid--variable-height > div.j-enhanced__details-box > div > div.j-advert-details__container > div > table > tbody > tr:nth-child(7) > td');
            return element ? element.textContent : null;
          });



      /*const validDeadline = getValidDeadline(post_deadline);

      if (!validDeadline) {
        console.log(`⏭️ SKIPPING: Deadline "${post_deadline}" is expired or invalid - ${post_title}`);
        return null; // Skip this post
      }*/

      let data = {
        post_title: post_title,
        post_position: post_position,
        post_Inst: post_Inst,
        app_link: app_link,
        post_deadline: post_deadline,     //rolling posts deleted at the end of the scrap year
        postLink: `${postLink}`,
      };

      console.log (data);

    };



    await extractPostDetails('https://www.jobs.ac.uk/job/DRF975/phd-studentship-digital-systems-governance-for-smart-sustainable-green-innovation-districts-designing-a-living-lab-framework-for-the-birmingham-knowledge-quarter');
    await page.close();
    await browser.close();
    console.log('returning to outer cron scope?...')
    return;


  } catch (error) {
    console.error(error);
  }
}

//console.profile();
get_jobs_ac_data();
//module.exports = {scrapJobs}
