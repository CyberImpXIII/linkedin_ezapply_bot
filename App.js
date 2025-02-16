const puppeteer = require('puppeteer');
require('dotenv').config();
// Or import puppeteer from 'puppeteer-core';

async function check_login(){
    if(process.env.USERNAME && process.env.PASSWORD){
        return true;
    }
    return false;
}

// Launch the browser and open a new blank page
( async ()=>{
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto('https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin');

    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    await page.waitForSelector('#username');

    await page.type('#username', 'your_username');

    await page.screenshot({
        path: 'screenshot.jpg'
      });

    await browser.close();})()