# Tapo Bulb Web Control

A simple web interface to control your Tapo smart bulbs through the Tapo REST API.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Access to the Tapo REST API server

## Installation

1. Clone this repository or download the files
2. Navigate to the project directory:
   ```bash
   cd HomeWeb
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your configuration:
   ```
   API_URL=http://localhost:8000  # URL of your Tapo REST API server
   API_PASSWORD=potatoes          # Password for the API
   ```

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```

2. Access the web interface:
   Open your browser and navigate to `http://localhost:3000`

## Features

- Control multiple Tapo bulbs from a single interface
- Turn bulbs on/off with simple button clicks
- Visual feedback for successful operations
- Error handling and status messages
- Automatic session management with the API

## Usage

1. The web interface will display controls for each bulb configured in your Tapo REST API
2. Click the "Turn On" button to turn a bulb on
3. Click the "Turn Off" button to turn a bulb off
4. Status messages will appear briefly to confirm the action

## Troubleshooting

If you encounter issues:

1. Check that the Tapo REST API server is running
2. Verify your API URL and password in the `.env` file
3. Check the console for any error messages
4. Ensure your bulbs are properly configured in the Tapo REST API

## Security Notes

- The application stores the API session token in memory
- The password is only used during initial login
- All communication with the API is done through your server

## Development

To modify the application:

1. The main server logic is in `server.js`
2. The web interface is in `public/index.html`
3. Styles are included in the HTML file
4. JavaScript for the interface is in the HTML file

## License

This project is open source and available under the MIT License. 