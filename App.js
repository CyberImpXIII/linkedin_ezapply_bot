const puppeteer = require('puppeteer');
require('dotenv').config();
const readline = require('readline-sync')
const fs = require('fs');
// Or import puppeteer from 'puppeteer-core';

const waitForDOMToSettle = (page, timeoutMs = 30000, debounceMs = 1000) =>
    page.evaluate(
      (timeoutMs, debounceMs) => {
        let debounce = (func, ms = 1000) => {
          let timeout;
          return (...args) => {
            console.log("in debounce, clearing timeout again");
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              func.apply(this, args);
            }, ms);
          };
        };
        return new Promise((resolve, reject) => {
          let mainTimeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error("Timed out whilst waiting for DOM to settle"));
          }, timeoutMs);
   
          let debouncedResolve = debounce(async () => {
            observer.disconnect();
            clearTimeout(mainTimeout);
            resolve();
          }, debounceMs);
   
          const observer = new MutationObserver(() => {
            debouncedResolve();
          });
          const config = {
            attributes: true,
            childList: true,
            subtree: true,
          };
          observer.observe(document.body, config);
        });
      },
      timeoutMs,
      debounceMs
    );

const delay = (time) => {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

const promise_forEach = async (array, asyncCallback)=>{
    return await Promise.all(array.map((element, index, array)=>(new Promise(()=>{asyncCallback(element, index, array)}))));
}

const scrapeIdsAndTotalPages = async (page)=>{
    return await page.evaluate(async() => {
        let jobDetails = {
            jobIds:[],
            totalPages:1
        };
        await document.querySelectorAll("[data-occludable-job-id]").forEach(element => {
            jobDetails.jobIds.push(element.getAttribute("data-occludable-job-id"));
        })
        jobDetails.totalPages = await Array.from(document.querySelectorAll("[data-test-pagination-page-btn]")).reduce((acc, curr) => {
            return (acc > parseInt(curr.getAttribute("data-test-pagination-page-btn"))) ? acc : parseInt(curr.getAttribute("data-test-pagination-page-btn"));
        }, 0);
        return jobDetails;
    })
}

const scrollDown = async (page)=>{
    const elem = await page.$('.scaffold-layout__list ');
    const boundingBox = await elem.boundingBox();
    await page.mouse.move(
        boundingBox.x + boundingBox.width / 2, // x
        boundingBox.y + boundingBox.height / 2 // y
    );
    
    await page.mouse.wheel({ deltaY: 2500 });
    }

let dataObj= {};

function check_login(){
    if(process.env.USERNAME && process.env.PASSWORD){
        return true;
    }else{
    readline.question('Enter your LinkedIn username: ', (username) => {
        fs.appendFileSync('file.log', "username: " + username + '\n');
    })
    readline.question('Enter your LinkedIn password: ', (password) => {
        fs.appendFileSync('file.log', "password: " + password + '\n');
        return true;
    });        
    }
}

// Launch the browser and open a new blank page
( async ()=>{
    if(fs.existsSync('file.log')){ 
        dataObj = JSON.parse(fs.readFileSync('file.log', 'utf8'))
    }else{
        console.log("No login credentials found");
        return true
    }
    
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto('https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin');

    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    await page.waitForSelector('#username');

    await page.type('#username', dataObj.username);

    await page.type('#password', dataObj.password);

    await page.click('button[aria-label="Sign in"]');

    await page.waitForSelector('li-icon[type="job"]');
//f_WT=2 is that same as remote only
//f_WT=1 is that same as on-site only
//f_AL=true is for easy apply
    await page.goto('https://www.linkedin.com/jobs/search?keywords=Software%20engineer&f_WT=2&f_AL=true');

    await waitForDOMToSettle(page);
    await scrollDown(page);
    let details = await scrapeIdsAndTotalPages(page);
    dataObj.jobIds = dataObj.jobIds ? [...dataObj.jobIds, ...details.jobIds] : [...details.jobIds];
    await console.log(details);
    await promise_forEach(Array(details.totalPages-1).fill(0), async (element, index, array)=>{
        await delay((index)*2000 + (Math.random() * (100 + (Math.random() * 100))))
        let currentPage = await browser.newPage();
        await currentPage.goto(`https://www.linkedin.com/jobs/search?keywords=Software%20engineer&f_WT=2&f_AL=true&start=${(index + 1 )* 25}`);
        await waitForDOMToSettle(currentPage, 600000);
        let details = await scrapeIdsAndTotalPages(currentPage);
        dataObj.jobIds = dataObj.jobIds ? [...dataObj.jobIds, ...details.jobIds] : [...details.jobIds];
        await currentPage.screenshot({
            path: `screenshot_${index + 1}.jpg`
          });
        await currentPage.close();
        return true;
    })
    await console.log(dataObj.jobIds);

    

    await page.screenshot({
        path: 'screenshot.jpg'
      });

    await browser.close();})()