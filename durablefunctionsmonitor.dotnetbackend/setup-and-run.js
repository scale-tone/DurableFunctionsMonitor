// Checks that a local.settings.json file exists in local folder.
// If not, asks the user to specify the Azure Storage connection string and creates the file.
// Then runs func start

const fs = require('fs');
const { spawn } = require('child_process');

function funcStart() {
    const funcProcess = spawn('func', ['start'], { shell: true });

    funcProcess.stdout.on('data', function (data) {
        console.log('Func.exe: ' + data.toString());
    });
}

if (fs.existsSync('./local.settings.json')) {
    console.log('An existing ./local.settings.json file found in local folder. Connection string initialization skipped.');

    funcStart();
    return;
}

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

readline.question(`A local.settings.json file needs to be created, with some Azure Storage Connection String in it.\n` +
    `Provide your Azure Storage Connection String: `, (connectionString) => {
        readline.close()
        
        if (!connectionString) {
            console.log(`No Connection String provided, cannot create the local.settings.json file. The app might not work.`);
            return;
        }

        const localSettings = {
            IsEncrypted: false,
            Values: {
                AzureWebJobsStorage: connectionString,
                FUNCTIONS_WORKER_RUNTIME: "dotnet"
            },
            Host: {
                LocalHttpPort: 7072,
                CORS: "http://127.0.0.1:7072,http://localhost:3001,http://127.0.0.1:3001",
                CORSCredentials: true
            }
        }

        fs.writeFileSync('local.settings.json', JSON.stringify(localSettings, null, 4));
        console.log(`A local.settings.json file was created successfully. You can use the UI menu button to change connection parameters later on.`)

        funcStart();
})
