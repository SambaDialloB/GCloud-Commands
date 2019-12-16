// jshint esversion: 9
var bq;
const path = "./gcloud_cred.json";

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
  
	let usage = await query(google_app_cred.project_id, secrets.billing_table_name);
  	return { response_type: 'in_channel', text: "GCloud Usage in bytes: " + usage[0].usage };
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
    const bqClient = new bq.BigQuery({projectId:projectId, keyFilename: path });
    
  //adds up all from the cost column of this test dataset 
    const sqlQuery = 'select SUM(usage.amount) as usage from ' + tableName ;

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
