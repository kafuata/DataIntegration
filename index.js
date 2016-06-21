"use strict";

let xlsx = require("xlsx");
let request = require("request-promise");

let serverBulkURL = "http://benjaminbeguin.com/erc/back/traitement.php";
let serverSingleURL = "http://benjaminbeguin.com/erc/back/traitement_id.php";
let workbook = xlsx.readFile("data.xlsx");

let sheetNames = process.argv.slice(2);
if (sheetNames.length === 0) {
  sheetNames = workbook.SheetNames; // use all sheets
}

let rawDataBySheet = sheetNames.map(function (sheetName) {
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}); 
let rawData = Array.prototype.concat.apply([], rawDataBySheet);

let json = rawData.map(recordConverter);
let formData = { json: JSON.stringify(json) };

console.log("Processing " + json.length + " records.");

request.post({ url: serverBulkURL, form: formData })
.then(function () {
  console.log("Bulk request successfully sent.");
});

Promise.all(json.map(sendSingleRequest))
.then(function () {
  console.log("All ID requests successfully sent.");
});

function sendSingleRequest(singleJson, id) {
  console.log("Sending ID request for id = " + id + " ...");

  return request.post({ url: serverSingleURL, form: {
    json: JSON.stringify([{story:"", tags:[], id: id, json: id}]),
    id: id,
    timestamp: Date.now()
  }}); 
}

function recordConverter(obj, index) {
  return {
    "picture": "http:\/\/placehold.it\/50x80",
    "firstname": obj["Prénom"],
    "lastname": obj["NOM"],
    "projectname": obj["nom du projet"],
    "gender": obj["Sexe"] || "male",
    "institute": obj["Institut de rattachement"],
    "quality" : obj["Qualité"],
    "panel": obj["panel"],
    "labo": obj["Laboratoire"],
    "birthdate": "1966-03-08T04:19:36",
    "erc_date": parseInt(obj["Année"], 10),
    "type": "",
    "id": index,
    "json" : index,
    "erc_type": obj["Type d\'ERC"]
  }; 
}
