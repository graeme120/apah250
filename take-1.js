// 1. Set up Google Sheets API (follow Google's documentation).
// 2. Authenticate with OAuth2 or API key.

function loadSheetData() {
  gapi.client.sheets.spreadsheets.values
    .get({
      spreadsheetId: "1Cuc04IRdPS_3ULZJD_IH1cNcGVEbdwFYLfA4vzpvCnY",
      range: "Sheet1!A2:E251",
    })
    .then(
      function (response) {
        const rows = response.result.values;
        if (rows.length > 0) {
          console.log("woohoo!");
          const chart = document.getElementById("chart");
          const chartGrid = document.createElement("div");
          chartGrid.className = "chart-grid";
          chart.appendChild(chartGrid);

          rows.forEach((row) => {
            // Create the item div
            const itemDiv = document.createElement("div");
            itemDiv.className = "item";

            // Insert the image tag
            const image = document.createElement("img");
            image.className = "artwork";
            image.src = row[4];
            itemDiv.appendChild(image);

            // Insert the h1 tag
            const h1 = document.createElement("h1");
            h1.className = "title";
            h1.textContent = `${row[0]}.${row[1]}`;
            itemDiv.appendChild(h1);

            // Insert the h2 tag
            const h2 = document.createElement("h2");
            h2.className = "subtitle";
            h2.textContent = row[2];
            itemDiv.appendChild(h2);

            // Insert the p tag
            const p = document.createElement("p");
            p.className = "blurb";
            p.textContent = row[3];
            itemDiv.appendChild(p);

            chartGrid.appendChild(itemDiv);
          });
        } else {
          console.log("No data found.");
        }
      },
      function (response) {
        console.error("Error: " + response.result.error.message);
      }
    );
}

// Load Google's gapi client, then call loadSheetData:
function loadClient() {
  gapi.client.setApiKey("AIzaSyDsU2UHFlSx_lMdl3jzUYDnbtyso5mHJbs"); // Make sure to replace with your actual API key.
  return gapi.client
    .load("https://content.googleapis.com/discovery/v1/apis/sheets/v4/rest")
    .then(
      () => {
        console.log("GAPI client loaded for API");
        loadSheetData(); // Call loadSheetData here, once the client is loaded.
      },
      (err) => {
        console.error("Error loading GAPI client for API", err);
      }
    );
}
