// jshint esversion: 9
var bq;
const path = "./gcloud_cred.json";
//var st;

/**
 * @description null
 * @param {ParamsType} params list of command parameters
 * @param {?string} commandText slack text message
 * @param {!object} [secrets = {}] list of secrets
 * @return {Promise<SlackBodyType>} Slack response body
 */
async function _command(params, commandText, secrets = {}) {
    if (!secrets || !secrets.gcloud_cred_json || !secrets.gcloud_cred_key || !secrets.billing_table_name) {
        return { body: { text: "You must create secrets for GCloud Billing service to use this command.\nSecrets required to run this command are: \ngcloud_cred_json \ngcloud_cred_key \nbilling_table_name" } };
    }

    if (!bq) {
        //Only installs on the first run after an edit
        console.log(await run("npm install --save @google-cloud/bigquery"));
        bq = require('@google-cloud/bigquery');
    }

    let google_app_cred = JSON.parse(secrets.gcloud_cred_json);
    google_app_cred.private_key = JSON.parse(secrets.gcloud_cred_key);

    setEV(google_app_cred);
    let totalCost = 0;
    let rows = await query(google_app_cred.project_id, secrets.billing_table_name);

    let tableBlocks = [];
    let tempBlock = {
        "type": "section",
        "fields": []
    };
    let fieldsArr = [];
    rows.forEach(row => {
        totalCost += row.cost;
        if (fieldsArr.length >= 10) {
            tempBlock.fields = fieldsArr.splice(0, 10);
            tableBlocks.push(tempBlock);
            tempBlock = {
                "type": "section",
                "fields": []
            };
        }
        fieldsArr.push({
            "type": "plain_text",
            "text": row.service
        }, {
            "type": "plain_text",
            "text": "$" + row.cost.toFixed(2)
        });
    });
    if (fieldsArr.length > 0) {
        tempBlock.fields = fieldsArr.splice(0, 10);
        tableBlocks.push(tempBlock);
    }
    let date = getDate();
    let costStr = "Google Cloud charges from " + date.month + ", " + date.year + ": $" + totalCost.toFixed(2);
    let blocks = [
        {
            "type": "section",
            "text": {
                "text": costStr,
                "type": "mrkdwn"
            },
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*Service*"
                },
                {
                    "type": "mrkdwn",
                    "text": "*Costs*"
                },
            ]
        },
    ];
    tableBlocks.forEach(block => {
        blocks.push(block);
    });
    return { response_type: 'in_channel', blocks };
}
function getDate() {
    var d = new Date();

    var month = new Array();
    month[0] = "January";
    month[1] = "February";
    month[2] = "March";
    month[3] = "April";
    month[4] = "May";
    month[5] = "June";
    month[6] = "July";
    month[7] = "August";
    month[8] = "September";
    month[9] = "October";
    month[10] = "November";
    month[11] = "December";
    var monthName = month[d.getMonth()];
    return {
        day: d.getDate(),
        month: monthName,
        year: d.getFullYear()
    };
}
function setEV(google_app_cred) {
    const fs = require('fs');

    if (!fs.existsSync(path)) {
        console.log("creating file");
        fs.writeFileSync(path, JSON.stringify(google_app_cred));
        console.log(JSON.parse(fs.readFileSync(path)));
    }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
}
async function query(projectId, tableName) {
    const bqClient = new bq.BigQuery({ projectId: projectId, keyFilename: path });

    //adds up all from the cost column of this test dataset 
    const sqlQuery = 'select service.description as service,  SUM(cost) as cost  from  ' + tableName + ' where EXTRACT(YEAR from usage_start_time) = EXTRACT(YEAR from CURRENT_DATE()) AND EXTRACT(MONTH from usage_start_time) = EXTRACT(MONTH from CURRENT_DATE()) group by service;';
    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    const options = {
        query: sqlQuery,
        // Location must match that of the dataset(s) referenced in the query.
        location: 'US',
    };
    // Run the query
    const [rows] = await bqClient.query(options);
    return rows;
}
async function run(str) {

    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(str, (err, stdout, stderr) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}
/**
 * @typedef {object} SlackBodyType
 * @property {string} text
 * @property {'in_channel'|'ephemeral'} [response_type]
 */

const main = async ({ __secrets = {}, commandText, ...params }) => ({ body: await _command(params, commandText, __secrets) });
module.exports = main;
