var SPREADSHEET_ID = "1Cuc04IRdPS_3ULZJD_IH1cNcGVEbdwFYLfA4vzpvCnY";
var TAB_NAME = "database";

// The initial comments remain unchanged.

document.addEventListener("DOMContentLoaded", function () {
  // Use XMLHTTPRequest or fetch API to get the JSON data
  fetch("https://opensheet.elk.sh/" + SPREADSHEET_ID + "/" + TAB_NAME)
    .then((response) => response.json())
    .then((data) => {
      let count = 0; // counter to count the rows matching the condition

      data.forEach(function (entry, index) {
        if (
          entry.src !== "https://www.datocms-assets.com/105819/1693441857-0.png"
        ) {
          count++;
        }
      });
      console.log(count);
      // Calculate the percentage
      let percentage = ((count / 250) * 100).toFixed(2);

      // Create the bar and set styles
      let barContainer = document.createElement("div");
      barContainer.className = "bar";

      let filledBar = document.createElement("div");
      filledBar.className = "filledBar";
      filledBar.style.width = percentage + "%";

      barContainer.appendChild(filledBar);
      document.querySelector("#title").appendChild(barContainer);

      let counter = document.createElement("div");
      counter.className = "counter";
      document.querySelector("#title").appendChild(counter);

      // Add the count display
      let countDisplay = document.createElement("div");
      countDisplay.className = "count";
      countDisplay.id = "count2";
      countDisplay.textContent = percentage + "%";
      document.querySelector(".counter").appendChild(countDisplay);

      let countDisplay2 = document.createElement("div");
      countDisplay2.className = "count";
      countDisplay2.id = "count1";
      countDisplay2.textContent = count + "/250 ";
      document.querySelector(".counter").appendChild(countDisplay2);

      //toggle counter views

      let count1Element = document.getElementById("count1");
      let count2Element = document.getElementById("count2");
      let chartwo = document.getElementById("chart2");
      let chartone = document.getElementById("chart");

      // Attach an event listener to the 'counter' element
      counter.addEventListener("click", function () {
        // Check the current display property of 'count1' and 'count2'
        // and toggle their display property between 'none' and 'block'
        count1Element.style.display =
          count1Element.style.display === "none" ? "block" : "none";

        count2Element.style.display =
          count2Element.style.display === "block" ? "none" : "block";
      });

      let title1 = document.getElementById("title1");
      let title2 = document.getElementById("title2");
      let modes = document.getElementById("modes");

      // Attach an event listener to the 'counter' element
      modes.addEventListener("click", function () {
        // Check the current display property of 'count1' and 'count2'
        // and toggle their display property between 'none' and 'block'
        title1.style.display =
          title1.style.display === "none" ? "block" : "none";
        chartwo.style.display =
          chartwo.style.display === "none" ? "block" : "none";

        title2.style.display =
          title2.style.display === "block" ? "none" : "block";
        chartone.style.display =
          chartone.style.display === "grid" ? "none" : "grid";
      });

      //load the data

      console.log(data);

      data.forEach(function (entry, index) {
        console.log(entry);

        var itemDiv = document.createElement("div");
        itemDiv.className = "item";

        var detailsDiv = document.createElement("div");
        detailsDiv.className = "details";

        var h1 = document.createElement("h1");
        h1.className = "artwork-title";
        h1.textContent = entry.number + ". " + entry.name;

        var h2 = document.createElement("h2");
        h2.textContent = entry.details;

        detailsDiv.appendChild(h1);
        detailsDiv.appendChild(h2);

        var img = document.createElement("img");
        img.className = "artwork";
        img.src = entry.src;

        var p = document.createElement("p");
        p.className = "blurb";
        p.textContent = entry.blurb;

        itemDiv.appendChild(detailsDiv);
        itemDiv.appendChild(img);
        itemDiv.appendChild(p);

        document.querySelector("#chart").appendChild(itemDiv);
      });
      const placeholders = [
        "Global Prehistory, 30,000–500 BCE ",
        "Ancient Mediterranean, 3500 BCE–300 CE",
        "Early Europe and Colonial Americas, 200–1750 CE",
        "Later Europe and Americas, 1750–1980 CE",
        "Indigenous Americas, 1000 BCE–1980 CE ",
        "Africa, 1100–1980 CE ",
        "West and Central Asia, 500 BCE–1980 CE",
        "South, East, and Southeast Asia, 300 BCE–1980 CE",
        "The Pacific, 700–1980 CE ",
        "Global Contemporary, 1980 CE to Present ",
      ];

      // Define row intervals for each div
      const intervals = [
        [0, 10],
        [11, 46],
        [47, 97],
        [98, 150],
        [151, 165],
        [166, 179],
        [180, 190],
        [191, 211],
        [212, 222],
        [223, 249],
      ];

      const chart2Element = document.getElementById("chart2");

      // Iterate over each interval

      intervals.forEach((interval, index) => {
        const sectionDiv = document.createElement("div");
        sectionDiv.className = "section-overview";

        // Add <h3> tag
        const h3 = document.createElement("h3");
        h3.className = "section-overview-title";
        h3.textContent = placeholders[index];
        chart2Element.appendChild(h3);

        // Add images for each row within the interval
        for (let i = interval[0]; i <= interval[1]; i++) {
          console.log(data[i].src);
          const img = document.createElement("img");
          img.className = "section-overview-image";
          img.src = data[i].src;
          sectionDiv.appendChild(img);
        }

        document.querySelector("#chart2").appendChild(sectionDiv);
      });
    })

    .catch((error) => {
      console.error("There was an error fetching the data:", error);
    });
});
