const puppeteer = require('puppeteer');
require('dotenv').config();
const readline = require('readline-sync')
const fs = require('fs');
// Or import puppeteer from 'puppeteer-core';

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

    await page.screenshot({
        path: 'screenshot.jpg'
      });

    await browser.close();})()