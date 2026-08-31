// ==UserScript==
// @name       Woolworths Trend
// @version     1.1
// @description A simple extension that adds historical price trends to woolworths.com.au
// @author      Originally by Data Holdings Group & Userscript made by Damodar Rajbhandari
// @match       *://*.woolworths.com.au/*
// @require     https://unpkg.com/chart.js@4.4.6/dist/chart.umd.js
// @require     https://unpkg.com/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.js
// @run-at document-start
// @grant       GM_xmlhttpRequest
// @connect     https://data-holdings-fastapi-lp22d.ondigitalocean.app
// @downloadURL https://github.com/physicslog/woolworths-trend.user.js/raw/refs/heads/main/woolworths-trend.user.js
// @updateURL   https://github.com/physicslog/woolworths-trend.user.js/raw/refs/heads/main/woolworths-trend.user.js
// ==/UserScript==

var styles = `
.dhg-card {
    display: block;
    width: 60%;
    margin: 20px 0;
    border-bottom: 2px solid #ffa500;
    background-color: #fff;
    position: relative;
    z-index: 1;
    flex: 0 0 100%;
    order: 9999;
}
.dhg-card-header {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    background-color: #ffffff;
    border-bottom: 2px solid #ffa500;
}
.dhg-title {
    font-size: 16px;
    font-weight: bold;
}
.dhg-card-content {
    padding: 10px;
}
.dhg-disclaimer {
    font-size: .8rem;
}
.spaced-item {
    margin-right: 1rem;
}
/* Chart html */
#priceHistoryChart {
    margin-top: 1rem;
    margin-bottom: 1rem;
}
`

var styleSheet = document.createElement("style")
styleSheet.textContent = styles
document.head.appendChild(styleSheet)

async function handleUrlChange() {
    const currentUrl = window.location.href;
    const match = currentUrl.match(/productdetails\/(\d+)/);
    
    if (match && match[1]) {
        let parsedProductId = parseInt(match[1], 10);
        console.log(`[Woolworths Trend] Valid product ID found: ${parsedProductId}`);
        await main(parsedProductId);
    }
}
window.addEventListener('load', handleUrlChange);

const observer = new MutationObserver(() => {
    if (window.location.href !== observer.currentUrl) {
        observer.currentUrl = window.location.href;
        handleUrlChange();
    }
});
observer.currentUrl = window.location.href;
observer.observe(document.body, { subtree: true, childList: true });

/*dhs.js*/
// Get the data -> JSON
async function fetchProductData(product_id) {
    const url = `https://data-holdings-fastapi-lp22d.ondigitalocean.app/woolworths/product_search/${product_id}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data.priceHistory)) {
            throw new Error('The response data is not an array');
        }
        return data;
    } catch (error) {
        return {
            "priceHistory": []
        };
    }
}
// Add days key to show number of days between last price change
function addDaysToPriceHistory(priceHistory) {
    // Function to calculate the number of days between two dates
    function calculateDaysBetween(date1, date2) {
        const msInDay = 24 * 60 * 60 * 1000; // Number of milliseconds in a day
        return Math.round((date2 - date1) / msInDay);
    }
    // Iterate over the array to add 'days' key
    for (let i = 0; i < priceHistory.length; i++) {
        const currentDate = new Date(priceHistory[i].date);
        let nextDate;
        if (i < priceHistory.length - 1) {
            // Use the next date in the array
            nextDate = new Date(priceHistory[i + 1].date);
        } else {
            // Use the current UTC date for the last entry
            nextDate = new Date();
        }
        // Calculate the number of days between the current date and the next date
        priceHistory[i].days = calculateDaysBetween(currentDate, nextDate);
    }
    return priceHistory;
}
// Filter data -> JSON
function filterHistory(priceHistory) {
    // If the priceHistory array is empty, return it immediately
    return priceHistory.slice(-10)
}
function insightsArray(priceHistory) {
    let minPrice = Math.min(...priceHistory.map(item => item.price));
    let maxPrice = Math.max(...priceHistory.map(item => item.price));
    let priceChanges = priceHistory.length;
    let uniquePrices = new Set(priceHistory.map(item => item.price))
        .size;
    let insightsArray = [];
    if (uniquePrices > 1) {
        insightsArray = [
            `⬇️ Low $${minPrice.toFixed(2)} `,
            `⬆️ High $${maxPrice.toFixed(2)} `,
            `➡️ ${priceChanges - 1} Price changes `,
            `➡️ ${uniquePrices} Different prices `
        ];
    }
    if (uniquePrices == 1) {
        insightsArray = [
            `⬇️ Low $${minPrice.toFixed(2)} `,
            `⬆️ High $${maxPrice.toFixed(2)} `,
            `➡️ ${priceChanges - 1} Price changes`,
        ];
    }
    let insightsHTML = insightsArray.map(item => `<span class="spaced-item">${item}</span>`)
        .join('');
    return insightsHTML
}
// Create html with insights -> HTML
function createDisclaimerHTML(minStatement) {
    return `
        <span style="display: block; font-size: 1rem; font-weight: bold;">
            ${minStatement.statement}
        </span>
    `;
}
// Create html canvas for chart object -> ?
function createLineChartHTML() {
    return `
        <canvas id="priceHistoryChart" width="400" height="200"></canvas>
    `;
}
function renderLineChart(priceHistory) {
    const ctx = document.getElementById('priceHistoryChart')
        .getContext('2d');
    const labels = priceHistory.map(entry => new Date(entry.date)
        .toLocaleDateString());
    const data = priceHistory.map(entry => entry.price.toFixed(2));
    // Registering the above chart to add labels via the plugin in lib
    Chart.register(ChartDataLabels);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price',
                data: data,
                fill: false,
                backgroundColor: 'rgba(255, 165, 0, .95)', // Set bar fill color to orange
                borderColor: 'rgba(255, 165, 0, 1)', // Set bar border color to orange
                borderWidth: 1, // Optional: set the border width
                tension: .4
            }]
        },
        options: {
            layout: {
                padding: {
                    top: 20
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: false,
                        text: 'Date'
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: false,
                        text: 'Price ($)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    // Use the 'labels' option to define multiple datalabels configurations
                    labels: {
                        // Price labels at the end of each bar
                        price: {
                            anchor: 'end',
                            align: 'end',
                            offset: 0,
                            formatter: function(value, context) {
                                return '$' + value; // Format the data label as price
                            },
                            color: 'black', // Color of the data label
                            font: {
                                size: 12
                            }
                        },
                        // Days labels at the center of each bar
                        days: {
                            anchor: 'start', // Center the label on the bar
                            align: 'start', // Align the label to the center
                            offset: -40,
                            formatter: function(value, context) {
                                const index = context.dataIndex; // Get the index of the current data point
                                const days = priceHistory[index].days; // Access the days value
                                return [days, 'Days']; // Return an array with two elements for a line break
                            },
                            color: '#4D4D4D', // Color of the data label
                            font: {
                                size: 12,
                                // weight: 'bold'
                            },
                            textAlign: 'center'
                        }
                    }
                }
            }
        }
    });
}
// Function to wait for an element to be available in the DOM
function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
        callback(element);
        return;
    }
    const observer = new MutationObserver((mutations, observer) => {
        if (document.querySelector(selector)) {
            callback(document.querySelector(selector));
            observer.disconnect();
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
// Plop HTML on page & update any already plopped things like canvas etc. -> Page updates
function updateDOMWithPriceHistory(filteredHistory, element) {
    //let productPriceElement = document.querySelector('ar-product-detail-panel');
    // Select the ar-image-gallery element
    let productPriceElement = element; //document.querySelector('ar-image-gallery.ar-image-gallery');
    // Log the main image element to the console
    console.log(productPriceElement);
    const html_template = `
        <div class="dhg-card">
            <div class="dhg-card-header">
                <span class="dhg-title">🔥 PRICE TREND ANALYSIS 🔥</span>
            </div>
            <div class="dhg-card-content">
                <canvas id="priceHistoryChart" width="350" height="200"></canvas>
                <span class="dhg-disclaimer">Price trends are based on data from the Woolworths online website without a specific location selected,
                                            reflecting movements over last 10 price changes. Actual prices may vary by store, especially for fresh food 
                                            and other perishable items.
                </span>
            </div>
        </div>
        `;
    let existingElement = document.querySelector('.dhg-card');
    if (existingElement) {
        // Remove the existing element
        existingElement.remove();
    }
    productPriceElement.insertAdjacentHTML('afterend', html_template);
    const dhgCard = document.querySelector('[class="dhg-card-content"]');
    if (productPriceElement) {
        renderLineChart(filteredHistory);
        dhgCard.insertAdjacentHTML('afterbegin', insightsArray(filteredHistory));
    }
}
// Main functions that strings all the above functions together
// async function main(productId) {
//     console.log("main called");
//     let productData = await fetchProductData(productId);
//     if (productData.priceHistory.length > 0) {
//         let productDataDays = addDaysToPriceHistory(productData.priceHistory);
//         let filteredHistory = filterHistory(productDataDays, 100);
//         //waitForElement('ar-image-gallery.ar-image-gallery', (element) => {
//             //waitForElement('h2.product-heading', (element) => {
//             //waitForElement('div.country-of-origin-label_component_country-of-origin-text__hSVKR', (element) => {    
//             waitForElement('section[aria-labelledby^="product-panel-title"]', (element) => {   
//                 //updateDOMWithPriceHistory(element);
//             updateDOMWithPriceHistory(filteredHistory,element);
//         });
//     }
// }
async function main(productId) {
    console.log("main called");
    const productData = await fetchProductData(productId);
    if (productData.priceHistory.length > 0) {
        const productDataDays = addDaysToPriceHistory(productData.priceHistory);
        const filteredHistory = filterHistory(productDataDays, 100);
        // Wait for the outer image-gallery wrapper, not the <section> inside it
        const WRAPPER_SEL = '.image-gallery-price-panel_component-container_image-gallery-price-panel__gs3wg';
        waitForElement(WRAPPER_SEL, (wrapperEl) => {
            // Insert our card AFTER the entire gallery block
            updateDOMWithPriceHistory(filteredHistory, wrapperEl);
        });
    }
}
/*
// Updated to work with new version of Woolworths site 03-2025
// Added wildcard country-of-origin
async function main(productId) {
    console.log("main called");
    let productData = await fetchProductData(productId);
    if (productData.priceHistory.length > 0) {
        let productDataDays = addDaysToPriceHistory(productData.priceHistory);
        let filteredHistory = filterHistory(productDataDays, 100);
        
        waitForElementMatchingClass('country-of-origin', (element) => {    
            updateDOMWithPriceHistory(filteredHistory, element);
        });
    }
}
*/
// New function to handle wildcard matching
function waitForElementMatchingClass(classSubstring, callback) {
    const checkExist = setInterval(() => {
        const elements = document.querySelectorAll('div'); // Get all div elements
        const matchedElement = Array.from(elements)
            .find(el =>
                el.className.includes(classSubstring) // Check if class contains the substring
            );
        if (matchedElement) {
            clearInterval(checkExist);
            callback(matchedElement);
        }
    }, 500); // Adjust polling interval as needed
}
