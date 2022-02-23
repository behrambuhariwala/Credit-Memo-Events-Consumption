
/**
* This script is a simple example of how Salesforce Platform Events
* can be consumed. Async APIs fire events to notify for completion.
* This example in particular is actively listening to the
* CreditInvoiceProcessedEvent which is fired on when a Credit Invoice Request
* has been processed. Once the request is processed, our custom integration here
* will unpack the response and notify the user on a slack channel via a slack
* web hook.
*
* Slack Web Hook - https://api.slack.com/messaging/webhooks
* JSforce https://jsforce.github.io/
*
* @author behram.buhariwala
*/

var jsforce = require('jsforce');
var axios = require('axios');

//Event Name.
var channel = "/event/CreditInvoiceProcessedEvent";

//Slack Web hook URL
const SLACK_WEB_HOOK = "https://hooks.slack.com/services/*********";

//Dirty hack for localhost connectivity
//process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

// -1 = Only New messages | -2 = All Window and New
var replayId = -1;

let username = "Rev@10a.com";
let password = "test1234";

// Login URL
let login_url = 'https://cs997.salesforce.com';

var conn = new jsforce.Connection({
  // you can change loginUrl to connect to sandbox or prerelease env.
   loginUrl : login_url
});

const options = {
        headers: {
            "Content-Type": "application/json; charset=UTF-8"
        }
};


conn.login(username, password, function(err, userInfo) {
  if (err) { return console.error(err); }

  // Now you can get the access token and instance URL information.
  // Save them to establish connection next time.

  console.log(conn.accessToken);
  console.log(conn.instanceUrl);

  let instanceUrl = conn.instanceUrl + "/lightning/r/";
  console.log(instanceUrl);

  // logged in user property
  console.log("User ID: " + userInfo.id);
  console.log("Org ID: " + userInfo.organizationId);

  //Create a client for streaming
  var client = conn.streaming.createClient([
      new jsforce.StreamingExtension.Replay(channel, replayId),
      new jsforce.StreamingExtension.AuthFailure(
          function() {
              return process.exit(1);
          }
      )
  ]);

  const options = {
          headers: {
              "Authorization": "Bearer " + conn.accessToken,
              "Content-Type": "application/json; charset=UTF-8"
          }
  };

  //Subsribe to event
  subscription = client.subscribe(channel, function(data) {
    console.log("Received data", JSON.stringify(data));

    //Unpack the respinse
    let payload = data["payload"];

    let creditMemoId = payload["CreditMemoId"];
    let invoiceId = payload["InvoiceId"];
    let requestIdentifier = payload["RequestIdentifier"];
    let isSuccess = payload["IsSuccess"].toString();

    let errorMessageString = "";
    let errors = payload["CrMemoProcessErrDtlEvents"];

    for(let i = 0 ; i < errors.length; i++) {
        errorMessageString += errors[i]["ErrorMessage"];
    }

    // send a POST request
    let creditMemoUrl = instanceUrl + "CreditMemo/" + creditMemoId + "/view";
    let invoiceUrl = instanceUrl + "Invoice/" + invoiceId + "/view";

    let message = "Your Credit Invoice Request has been processed : \nCreditMemo Record-" + creditMemoUrl + "\n Invoice Record - " + invoiceUrl + "\n Success - " + isSuccess + " \n Error Message: " + (errorMessageString.length > 0 ? errorMessageString : "None" );
    /*
    Example:
    Your Credit Invoice Request has been processed :
    CreditMemo Record-[instanceUrl]/CreditMemo/50g2q0000000EoFAAU/view
    Invoice Record -[instanceUrl]/Invoice/3tt2q00000001b3AAA/view
    Success - true
    Error Message: None
    */
    axios({
      method: 'POST',
      url: SLACK_WEB_HOOK,
      headers: options.headers,
      data: {
        text: message
      }
         }).then((response) => {
      console.log("Message sent to channel" , response);
    }, (error=> {
      console.log("Message not sent" , error);
    }))
  });

});
