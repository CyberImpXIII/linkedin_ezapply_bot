const puppeteer = require('puppeteer');
const path = require('path');
require('dotenv').config({
    override: true,
    path:path.join(__dirname, 'development.env')
});
const readline = require('readline-sync')
const fs = require('fs');
const { Pool, Client } = require('pg')

const pool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT
});

//test connection

(async ()=>{
    const client = await pool.connect();
    try{
        const {rows} = await client.query('SELECT current_user');
        const currentUser = rows[0].current_user;
        console.log(`${currentUser} is connected to ${process.env.DATABASE}`)
    }catch(error){
        console.error('Error connecting to database', error);
    }finally{
        client.release();
    }
})();

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

const login = async (page)=>{
    if(fs.existsSync('file.log')){ 
        dataObj = JSON.parse(fs.readFileSync('file.log', 'utf8'))
    }else{
        console.log("No login credentials found");
        return true
    }
    await page.goto('https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin');
    await page.waitForSelector('#username');
    await page.type('#username', dataObj.username);
    await page.type('#password', dataObj.password);
    await page.click('button[aria-label="Sign in"]');
    await page.waitForSelector('li-icon[type="job"]');
}
    
const delay = (time) => {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

const promise_forEach = async (array, asyncCallback)=>{
    return await Promise.all(array.map((element, index, array)=>(new Promise((resolve, reject)=>{
        asyncCallback(element, index, array, resolve, reject);
    }))));
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

const detectFormFields = async (page)=>{
    await console.log("detecting form fields");
    await waitForDOMToSettle(page);
    await page.waitForSelector('.fb-dash-form-element');
    let formFieldsData = await page.evaluate(()=>{
        let rawFormFields = document.querySelectorAll('.fb-dash-form-element');
        let formFieldsData = [];
        rawFormFields.forEach(element => {
            let elementObject = {}
            if(element.querySelector('label').hasAttribute('data-test-text-entity-list-form-title')){
                elementObject.type = 'list'
                elementObject.name = element.querySelector('label.fb-dash-form-element__label').innerText.split('\n')[0].trim();
                elementObject.required = element.querySelector('label.fb-dash-form-element__label-title--is-required')!==null
                elementObject.choices = [];
                elementObject.default = element.querySelector('select').value;
                [...element.querySelector('select').children].forEach(child => {
                    elementObject.choices.push(child.innerText.trim());
                })
            }else if(element.querySelector('input[type="text"]')){
                elementObject.type = 'text'
                elementObject.name = element.querySelector('label')?.innerText;
                elementObject.required = element.querySelector('input[type="text"]').getAttribute('required')!==null
                elementObject.default = element.querySelector('input[type="text"]').value;
            }else if(element.querySelector('fieldset[data-test-form-builder-radio-button-form-component="true"]')){
                elementObject.type = 'radio'
                elementObject.name = element.querySelector('label')?.children[0]?.innerText;
                elementObject.required = element.querySelector('label.fb-dash-form-element__label-title--is-required')!==null
                elementObject.default = element.querySelector('input[type="radio"]').value;
                elementObject.choices = [];
                [...element.querySelectorAll('input[type="radio"]')].forEach(radio => {
                    elementObject.choices.push(radio.value);
                })
            }
            formFieldsData.push(elementObject);
        })
        return formFieldsData;
    })
    return formFieldsData;
}

//apply for one job currently only handles retrieving the first set of form fields
const applyForOneJob = async (page, jobId)=>{
    await page.goto(`https://www.linkedin.com/jobs/view/${jobId}`);
// I'm guessing the emberIDs are dependenat on when the element is rendered so it is different each time
// I'm now trying to use the fact that I know the button I want to click is the second one on the page as a way to find it
    await page.waitForSelector('.jobs-s-apply');
    let applyButton = await page.$$('.jobs-s-apply');
    await applyButton[1].click();
    await page.waitForSelector('div[data-test-modal-id="easy-apply-modal"]');
    const formFields = await detectFormFields(page);
    await console.log(formFields);
}

/*(async ()=>{
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await login(page);
    // await scrapeAllJobIds();
    await applyForOneJob(page, '4142835614');
    await browser.close();
})();
*/
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
const scrapeAllJobIds = async ()=>{

    
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await login(page);


//f_WT=2 is that same as remote only
//f_WT=1 is that same as on-site only
//f_AL=true is for easy apply
    await page.goto('https://www.linkedin.com/jobs/search?keywords=Software%20engineer&f_WT=2&f_AL=true');

    await waitForDOMToSettle(page);
    await scrollDown(page);
    let details = await scrapeIdsAndTotalPages(page);
    dataObj.jobIds = dataObj.jobIds ? [...dataObj.jobIds, ...details.jobIds] : [...details.jobIds];
    await console.log(details);
    await promise_forEach(Array(details.totalPages-1).fill(0), async (element, index, array, resolve, reject)=>{
        await delay((index)*2000 + (Math.random() * (100 + (Math.random() * 100))))
        let currentPage = await browser.newPage();
        await currentPage.goto(`https://www.linkedin.com/jobs/search?keywords=Software%20engineer&f_WT=2&f_AL=true&start=${(index + 1 )* 25}`);
        await waitForDOMToSettle(currentPage, 600000);
        let details = await scrapeIdsAndTotalPages(currentPage);
        dataObj.jobIds = dataObj.jobIds ? [...dataObj.jobIds, ...details.jobIds] : [...details.jobIds];
        await currentPage.close();
        resolve();
    })
    await console.log(dataObj.jobIds);

    

    await page.screenshot({
        path: 'screenshot.jpg'
      });

    await browser.close();
}