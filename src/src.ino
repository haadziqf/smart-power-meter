#include "wifi_manager.h"
#ifdef ESP8266
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#else
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#endif
#include <ArduinoJson.h>
#include <EEPROM.h>

// Config storage structure
struct ConfigData {
  char serverUrl[100];
  char deviceId[30];
  int interval;
  float initialKwh;
  char configVersion[10]; // To identify config format
};

// Default values
const char* DEFAULT_SERVER_URL = "http://localhost:3002/iot";
const char* DEFAULT_DEVICE_ID = "device_001";
const int DEFAULT_INTERVAL = 5000;
const float DEFAULT_KWH = 100.0;
const char* API_CONFIG_VERSION = "v1.0";

// EEPROM addresses
const int CONFIG_ADDR = 200; // Start address for config (away from WiFi credentials)

// Runtime settings
unsigned long previousMillis = 0;
float lastKwhValue = 0;

// Config storage
ConfigData config;

WiFiManager wifiManager;
bool configSaved = false;

void setup() {
    Serial.begin(115200);
    Serial.println("Smart Power Meter - Config-based Test");
    
    // Load configuration from EEPROM
    loadConfig();
    
    // Initialize the WiFi Manager
    wifiManager.begin();
    wifiManager.startAPMode();
    
    // Inisialisasi nilai awal tanpa UI konfigurasi
    randomSeed(analogRead(0));
    if (config.initialKwh > 0) {
        lastKwhValue = config.initialKwh;
    } else {
        lastKwhValue = random(1000, 2000) / 10.0;
    }
    
    // Tampilkan konfigurasi
    Serial.println("Configuration:");
    Serial.print("Server URL: ");
    Serial.println(config.serverUrl);
    Serial.print("Device ID: ");
    Serial.println(config.deviceId);
    
    wifiManager.on("/config", HTTP_POST, handleConfig);
}

void loop() {
    wifiManager.handleClient();
    
    // Only send data if we're connected to WiFi in station mode
    if (!wifiManager.isAPMode() && WiFi.status() == WL_CONNECTED) {
        unsigned long currentMillis = millis();
        
        if (currentMillis - previousMillis >= config.interval) {
            previousMillis = currentMillis;
            
            // Generate a realistic random increment (0.01 to 0.5 kWh)
            float increment = random(1, 50) / 100.0;
            lastKwhValue += increment;
            
            // Send the data
            sendKwhData(lastKwhValue);
        }
    }
}

void setupAPIEndpoints() {
    // Add custom endpoints to the WiFiManager's web server
    wifiManager.on("/api-config", HTTP_GET, handleApiConfigPage);
    wifiManager.on("/save-api-config", HTTP_POST, handleSaveApiConfig);
    
    // Modify the root handler to add a link to API configuration
    wifiManager.on("/", HTTP_GET, []() {
        String html = wifiManager.getStatus();
        // Inject our API config link before the closing body tag
        int bodyEndPos = html.indexOf("</body>");
        if (bodyEndPos > 0) {
            String apiConfigLink = "<div class='setting-row'>"
                                   "<div class='setting-icon'>"
                                   "<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor'>"
                                   "<path stroke-linecap='round' stroke-linejoin='round' d='M13.5 16.5h-10a1.5 1.5 0 01-1.5-1.5v-10A1.5 1.5 0 013.5 3.5h10a1.5 1.5 0 011.5 1.5v10a1.5 1.5 0 01-1.5 1.5z'/>"
                                   "<path stroke-linecap='round' stroke-linejoin='round' d='M17.5 10.5V7.5a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5v2a1.5 1.5 0 01-1.5 1.5h-2a1.5 1.5 0 01-1.5-1.5z'/>"
                                   "</svg>"
                                   "</div>"
                                   "<a href='/api-config' class='settings-link'>API Configuration</a>"
                                   "</div>";
            html = html.substring(0, bodyEndPos) + apiConfigLink + html.substring(bodyEndPos);
        }
        wifiManager.send(200, "text/html", html);
    });
}

void handleApiConfigPage() {
    String html = "<!DOCTYPE html>"
                "<html>"
                "<head>"
                "<title>API Configuration</title>"
                "<meta name='viewport' content='width=device-width, initial-scale=1'>"
                "<style>"
                "body {"
                "  font-family: Arial, sans-serif;"
                "  margin: 0;"
                "  padding: 0;"
                "  background-color: #f8f9fa;"
                "}"
                ".container {"
                "  max-width: 800px;"
                "  margin: 0 auto;"
                "  padding: 20px;"
                "}"
                ".card {"
                "  background-color: #fff;"
                "  border-radius: 5px;"
                "  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);"
                "  margin-bottom: 20px;"
                "  padding: 20px;"
                "}"
                ".form-group {"
                "  margin-bottom: 15px;"
                "}"
                "label {"
                "  display: block;"
                "  margin-bottom: 5px;"
                "  font-weight: bold;"
                "}"
                "input[type='text'], input[type='number'] {"
                "  width: 100%;"
                "  padding: 10px;"
                "  border: 1px solid #ddd;"
                "  border-radius: 4px;"
                "  font-size: 16px;"
                "}"
                ".btn {"
                "  background-color: #007bff;"
                "  color: white;"
                "  border: none;"
                "  border-radius: 4px;"
                "  padding: 10px 15px;"
                "  font-size: 16px;"
                "  cursor: pointer;"
                "}"
                ".btn:hover {"
                "  background-color: #0069d9;"
                "}"
                ".success-message {"
                "  background-color: #d4edda;"
                "  color: #155724;"
                "  padding: 10px;"
                "  border-radius: 4px;"
                "  margin-bottom: 20px;"
                "}"
                "</style>"
                "</head>"
                "<body>"
                "<div class='container'>"
                "<h1>API Configuration</h1>";
    
    // Add success message if config was just saved
    if (configSaved) {
        html += "<div class='success-message'>Configuration saved successfully!</div>";
        configSaved = false;
    }
    
    html += "<div class='card'>"
            "<form action='/save-api-config' method='post'>"
            "<div class='form-group'>"
            "<label for='serverUrl'>Server URL:</label>"
            "<input type='text' id='serverUrl' name='serverUrl' value='" + String(config.serverUrl) + "' placeholder='http://server-address:3002/iot' required>"
            "</div>"
            "<div class='form-group'>"
            "<label for='deviceId'>Device ID:</label>"
            "<input type='text' id='deviceId' name='deviceId' value='" + String(config.deviceId) + "' placeholder='device_001' required>"
            "</div>"
            "<div class='form-group'>"
            "<label for='interval'>Send Interval (ms):</label>"
            "<input type='number' id='interval' name='interval' value='" + String(config.interval) + "' min='1000' max='3600000'>"
            "</div>"
            "<button type='submit' class='btn'>Save Configuration</button>"
            "</form>"
            "</div>"
            "<a href='/' style='display: inline-block; margin-top: 10px;'>Back to Main Menu</a>"
            "</div>"
            "</body>"
            "</html>";
    
    wifiManager.send(200, "text/html", html);
}

void handleSaveApiConfig() {
    if (wifiManager.hasArg("serverUrl") && wifiManager.hasArg("deviceId") && wifiManager.hasArg("interval")) {
        String serverUrl = wifiManager.arg("serverUrl");
        String deviceId = wifiManager.arg("deviceId");
        String intervalStr = wifiManager.arg("interval");
        
        // Copy values to config struct (with bounds checking)
        strncpy(config.serverUrl, serverUrl.c_str(), sizeof(config.serverUrl) - 1);
        config.serverUrl[sizeof(config.serverUrl) - 1] = '\0'; // Ensure null termination
        
        strncpy(config.deviceId, deviceId.c_str(), sizeof(config.deviceId) - 1);
        config.deviceId[sizeof(config.deviceId) - 1] = '\0'; // Ensure null termination
        
        // Convert interval string to int
        int interval = intervalStr.toInt();
        if (interval >= 1000 && interval <= 3600000) {
            config.interval = interval;
        }
        
        // Save to EEPROM
        saveConfig();
        
        // Set flag to show success message
        configSaved = true;
        
        // Redirect back to config page
        wifiManager.sendHeader("Location", "/api-config");
        wifiManager.send(302, "text/plain", "");
    } else {
        wifiManager.send(400, "text/plain", "Missing required fields");
    }
}

void loadConfig() {
    EEPROM.begin(512);
    
    // Read config from EEPROM
    EEPROM.get(CONFIG_ADDR, config);
    
    // Check if we have valid config (by checking version string)
    if (strcmp(config.configVersion, API_CONFIG_VERSION) != 0) {
        // No valid config found, use defaults
        Serial.println("No valid configuration found. Using defaults.");
        
        strcpy(config.serverUrl, DEFAULT_SERVER_URL);
        strcpy(config.deviceId, DEFAULT_DEVICE_ID);
        config.interval = DEFAULT_INTERVAL;
        config.initialKwh = DEFAULT_KWH;
        strcpy(config.configVersion, API_CONFIG_VERSION);
        
        // Save default config
        saveConfig();
    } else {
        Serial.println("Configuration loaded from EEPROM.");
    }
    
    EEPROM.end();
}

void saveConfig() {
    EEPROM.begin(512);
    
    // Write config to EEPROM
    EEPROM.put(CONFIG_ADDR, config);
    EEPROM.commit();
    
    EEPROM.end();
    
    Serial.println("Configuration saved to EEPROM.");
}

void sendKwhData(float kwhValue) {
    WiFiClient client;
    HTTPClient http;
    
    Serial.print("Attempting to connect to: ");
    Serial.println(config.serverUrl);
    
    // Use the configured server URL
    if (!http.begin(client, config.serverUrl)) {
        Serial.println("Failed to begin HTTP connection");
        return;
    }
    
    // Set headers
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Accept", "application/json");
    
    // Create JSON document
    StaticJsonDocument<200> doc;
    doc["device_id"] = config.deviceId;
    doc["kwh_value"] = kwhValue;
    doc["timestamp"] = millis(); // Add timestamp
    
    // Serialize JSON to string
    String requestBody;
    serializeJson(doc, requestBody);
    
    Serial.print("Sending request body: ");
    Serial.println(requestBody);
    
    // Send HTTP POST request
    Serial.print("Sending kWh value: ");
    Serial.println(kwhValue);
    int httpResponseCode = http.POST(requestBody);
    
    // Check response
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
        Serial.print("Response: ");
        Serial.println(response);
    } else {
        Serial.print("Error code: ");
        Serial.println(httpResponseCode);
        Serial.print("Error message: ");
        Serial.println(http.errorToString(httpResponseCode));
        
        // Additional error information
        Serial.print("WiFi status: ");
        Serial.println(WiFi.status());
        Serial.print("Local IP: ");
        Serial.println(WiFi.localIP());
    }
    
    // Free resources
    http.end();
}

void handleConfig() {
    if (wifiManager.hasArg("version")) {
        String version = wifiManager.arg("version");
        if (version == API_CONFIG_VERSION) {
            wifiManager.send(200, "text/plain", "OK");
        } else {
            wifiManager.send(400, "text/plain", "Invalid version");
        }
        return;
    }

    if (!wifiManager.hasArg("ssid") || !wifiManager.hasArg("password")) {
        wifiManager.send(400, "text/plain", "Missing required parameters");
        return;
    }

    String ssid = wifiManager.arg("ssid");
    String password = wifiManager.arg("password");

    if (wifiManager.connectToWiFi(ssid.c_str(), password.c_str())) {
        wifiManager.send(200, "text/plain", "Connected successfully");
    } else {
        wifiManager.send(500, "text/plain", "Connection failed");
    }
} 