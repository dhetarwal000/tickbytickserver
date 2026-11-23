
require("dotenv").config();const { google } = require("googleapis");
async function test(){

const auth = new google.auth.GoogleAuth({

keyFile:  "./keys/google-service-account.json",

scopes:[
"https://www.googleapis.com/auth/spreadsheets"
]

});

const sheets = google.sheets({

version:"v4",

auth

});

console.log(process.env.SPREADSHEET_ID);
const res =
await sheets.spreadsheets.get({
spreadsheetId:process.env.SPREADSHEET_ID

});

console.log(res.data.properties.title);

}

test();