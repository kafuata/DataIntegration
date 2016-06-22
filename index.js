"use strict";

let fs = require("fs");
let path = require("path");
let levenshtein = require('fast-levenshtein');

let xlsx = require("xlsx");
let request = require("request-promise");

let imagesDirectory = "/home/clarisse/Downloads/erc/PhotosErc/";
let serverUploadURL = "http://benjaminbeguin.com/erc/back/traitement_img.php";
let serverBulkURL = "http://benjaminbeguin.com/erc/back/traitement.php";
let serverSingleURL = "http://benjaminbeguin.com/erc/back/traitement_id.php";
let workbook = xlsx.readFile("data.xlsx");

let lang = 'fr';

let sheetNames = process.argv.slice(2);
if (sheetNames.length === 0) {
  sheetNames = workbook.SheetNames; // use all sheets
}
let rawDataBySheet = sheetNames.map(function (sheetName) {
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}); 
let rawData = Array.prototype.concat.apply([], rawDataBySheet);

let json = rawData.map(recordConverter);
let formData = { json: JSON.stringify(json), lang: lang };

let fileNames = fs.readdirSync(imagesDirectory);

/*
json.forEach(findBestMatch);
process.exit();
*/

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

  let match = findBestMatch(singleJson); 
  let filePath = imagesDirectory + match.fileName;

  if (match.distance > 2) {
    // match not good enough, skip
    return Promise.resolve(true);
  }

  return request
    .post({ url: serverSingleURL, form: {
      json: JSON.stringify([{story:"", tags:[], id: id, json: id}]),
      id: id,
      lang: lang
    }})
    .then(function () {
      return request.post({
        url: serverUploadURL,
        formData: {
          ID: id,
          NAME: singleJson.picture,
          MAX_FILE_SIZE: 500000,
          image: fs.createReadStream(filePath)
        }
      });
    })
    .then(function () {
      process.stdout.write("."); // barre de progression
    });
}

function recordConverter(obj, index) {
  let firstname = obj["Prénom"].trim();
  let lastname = obj["NOM"].trim();
  return {
    "picture": firstname.toLowerCase() + lastname.toLowerCase() + Date.now() + ".jpg",
    "firstname": firstname,
    "lastname": lastname,
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

function findBestMatch (item) {
  var currentName = item.firstname.toLowerCase() + ' ' + item.lastname.toLowerCase();

  let sigles = ['cog', 'stg', 'adg', 'insb', 'inp', 'inee'];

  function clean (name) {
    name = name.toLowerCase();
    //filename.toLowerCase().replace(/-/g, ' ').split(' ').slice(0, 2).join(' '),
   
      name = name.replace(new RegExp('.jpg'), '');
    return name;
  }

  let distances = fileNames.map(filename => levenshtein.get(
       clean(filename),
        currentName
  ));

  let minDistance = Math.min.apply(null, distances);
  let index = distances.indexOf(minDistance);

  // console.log(minDistance + ': ' + currentName + " => " + fileNames[index]);
  // if (minDistance <= 2) console.log(fileNames[index]);

  return { distance: minDistance, fileName: fileNames[index] };
}
