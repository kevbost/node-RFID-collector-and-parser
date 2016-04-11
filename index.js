/*
*   This code example was built with the mindset of experimentation
*   rather than perfection.
*
*   It listens for serial input from an RFID scanner
*   (such as you will find in E-ZPass systems) and parse
*   the proprietary tag data out into it's predefined sections.
*
*   If you want to run it, cool dude -- go for it. It will definitely
*   run, but without a serial connection over USB or at `networkIp`
*   it won't have any data to parse.
*
*   Since there was a possibility of over 1000 RFID signals being read
*   at one time, I decided to separate the functions into different "tasks",
*   one that collects data until it's told not to, and one that parses a .txt
*   file into both CSV and JSON files.
*
*   kevbost.github.io
*/


var serialport          = require("serialport"),
    fs                  = require('fs'),
    net                 = require('net'),
    moment              = require('moment'),
    chalk               = require('chalk'),
    log                 = require('single-line-log').stdout,
    inquirer            = require('inquirer'),
    readline            = require('readline'),
    SerialPort          = serialport.SerialPort;

/*
*   Mutable variable, set to true if 'Log Only' option is chosen
*   Will not write to file if set to true.
*/
var logOnly             = false;

/*
*   USB Serial Definitions
*   Change these options to match your needs based on
*   https://github.com/voodootikigod/node-serialport
*/
var usbDriver,
    usbWindowsDriver    = "COM3",
    usbOSXDriver        = "/dev/cu.usbserial-AH000I24",
// var usbDriver           = "/dev/cu.usbserial-AH000I24",  // OSX
// var usbDriver           = "COM3",                           // Windows
    client              = new net.Socket()
    // sp                  = new SerialPort(usbDriver, {
    //                         parser: serialport.parsers.readline("\n"),
    //                         baudrate: 9600
    //                     }, false);


/*
*   TCP/IP Network IP Definition
*   Backups:
*     '192.168.5.59'
*/
var networkIp           = '192.168.1.79';


/*
*   Filename Definitions
*   Counter and mutable JSON placeholder
*/
var counter             = 0,
    obj                 = {records: []},
    filenameTXT         = './raw/' + moment().format('YYYYMMMDDhhmmss') + '.txt',
    filenameJSON        = './json/' + moment().format('YYYYMMMDDhhmmss') + '.json',
    filenameCSV         = './csv/' + moment().format('YYYYMMMDDhhmmss') + '.csv',
    filenameRead;


/*
*   _LISTENER
*   Responsible for:
*     opening serial communication,
*     open network communication,
*     removing special characters (\n & \r),
*     appending simple data to new .txt file:
*         time-of-reading, raw-data
*         time-of-reading, raw-data
*         time-of-reading, raw-data
*
*/
var _LISTENER = {
    _initSerial: function(){
        console.log(usbDriver);
        /*
        *   Serial Communication
        */
        var sp = new SerialPort(usbDriver, {
            parser: serialport.parsers.readline("\n"),
            baudrate: 9600
        }, false);
        sp.open(function (error) {
            if ( error ) {
                console.log(chalk.red('\nUSB failed to open: ' + error));
                return _LISTENER._initNetwork();
            } else if (logOnly == true) {
                console.log('\n' + chalk.green('Connected over USB at ' + chalk.yellow(usbDriver)));
                console.log(chalk.cyan.bold('Not saving to file, only reporting log data') + '\n');
                sp.on('data', function(data) {
                    _LISTENER._dispatcher(data);
                });
            } else {
                console.log('\n' + chalk.green('Connected over USB at ' + chalk.yellow(usbDriver)));
                console.log(chalk.cyan.bold('Writing to filename: ') + chalk.magenta(filenameTXT) + '\n');
                sp.on('data', function(data) {
                    _LISTENER._dispatcher(data);
                });
            }
        });
    },

    _initNetwork: function(){
        /*
        *   Network Communication
        */
        client.connect(2000, networkIp);
        client.on('error', function(error){
            console.log(chalk.yellow('No network connection on ' + networkIp));
        });
        client.on('connect', function(error){
            if (logOnly == true) {
                console.log('\n' + chalk.green('Connected over USB at ' + chalk.yellow(usbDriver)));
                console.log(chalk.cyan.bold('Not saving to file, only reporting log data') + '\n');
            } else {
                console.log(chalk.green('Great Success!') + '\n' + chalk.cyan.bold('Connected, writing to filename: ') + chalk.magenta(filenameTXT) + '\n');
            }
        });
        client.on('data', function(data){
            return _LISTENER._dispatcher(data);
        });
        client.on('close', function(){
            console.log(chalk.magenta('Net connection closed\n'));
        });
    },

    _dispatcher: function(input){
        /*
        *   _dispatcher skips the first few RFID readings
        *   Without this, the first line will always be a
        *   dump of the buffer stored on the device.
        */
        counter++;
        if(counter <= 2){
            return;
        } else {
            return _LISTENER._removeSpecialCharacters(input);
        }
    },

    _removeSpecialCharacters: function(input){
        /*
        *   Removes \n and \r special characters
        */
        var buffer = input.toString().split('');
        input.toString().split('')
            .map(function(l){
            if(l == "\n" || l == "\r"){
                buffer.splice(buffer.indexOf(l), 1);
            }
        });
        return _LISTENER._appendToFile(buffer.join(''));
    },

    _appendToFile: function(input){
        /*
        *   appends time + raw-data to filenameTxt
        */
        var time = moment().format("HH:mm:ss.SSS");
        var inputPlusTime = moment().format("HH:mm:ss.SSS") + "," + input + '\n';
        console.log(chalk.yellow(counter) + ': ' + time + ', ' + input);

        if (logOnly == false) {
            fs.appendFile(filenameTXT, inputPlusTime);
        }
    }
};


/*
*   _PARSER
*   Responsible for:
*     letting the user choose which file to convert to JSON and CSV from the ./raw directory
*     reads file line-per-line, splits and passes to object parser
*     splits data into JSON object via a series of hard coded arr.split's
*     writes to JSON and CSV directories
*/
var _PARSER = {
    _initParser: function(){
        /*
        *   Reads ./raw directory and acts on user input
        */
        files = fs.readdirSync('./raw').reverse();
        // files.splice(files.indexOf('.DS_STORE'), 1);
        if (files.length < 1) { _Force_Exit('no_files'); }
        files.push('Exit');
        inquirer.prompt([
            {
                type: 'list',
                name: 'pick_a_file',
                message: 'Pick a file to parse into JSON && CSV',
                choices: files
            }
        ], function(answer){
            if (answer.pick_a_file === 'Exit') {
                return _Force_Exit('user_exit');
            }
            var csvText = "loc, hash, signal.base, signal.first, signal.second, checksum, raw, time\r\n";
            filenameRead = './raw/' + answer.pick_a_file;

            _PARSER._readLines(filenameRead);
            fs.writeFileSync(filenameCSV, csvText);
        });
    },

    _readLines: function(input) {
        /*
        *   reads chosen raw file line by line and parses accordingly
        */
        readline.createInterface({
            input: fs.createReadStream(input)
        }).on('line', function(line) {
            _PARSER._buildObject(line.split(','));
        }).on('close', function(line){
            _PARSER._write_JSON(JSON.stringify(obj));
            console.log('\n' + chalk.green.bold('       Reading From: ') + chalk.yellow(filenameRead));
            console.log(chalk.cyan.bold('Writing to filename: ') + chalk.magenta(filenameJSON) + '\n' +
                        chalk.cyan.bold('Writing to filename: ') + chalk.magenta(filenameCSV));
            console.log(' ');
        });
    },

    _buildObject: function(input){
        /*
        *   runs for-each line, passes each to a new _DataSet
        *   builds CSV directly since each line can be appended once finished
        */
        var bufferObject = new _PARSER._DataSet(input[0], input[1]);
        obj.records.push(bufferObject);

        var csv_builder = bufferObject.loc + "," + bufferObject.hash + "," + bufferObject.signal.base + "," + bufferObject.signal.first + "," + bufferObject.signal.second + "," + bufferObject.checksum + "," + bufferObject.raw + "," + bufferObject.time + "\r\n";
        fs.appendFile(filenameCSV, csv_builder);
    },

    _write_JSON: function(json){
        /*
        *   Writes JSON file. . .
        */
        fs.writeFileSync(filenameJSON, json);
    },

    _byteString: function(n) {
        /*
        *   Thanks stackoverflow.
        *   converts digits into binary equivalents
        */
        if (n < 0 || n > 255 || n % 1 !== 0) {
            throw new Error(n + " does not fit in a byte");
        }
        return ("000000000" + n.toString(2)).substr(-8);
    },

    _DataSet: function(time, input){
        /*
        *   Hard-coded JSON object builder - uses input.slice(index, to-index);
        */
        var newobj = {
            loc: input.slice(0, 4),
            hash: input.slice(4, 16),
            signal: {
                base: input.slice(17, 19),
                first: _PARSER._byteString(parseInt(input.slice(17,18))),
                second: _PARSER._byteString(parseInt(input.slice(18,19)))
            },
            checksum: input.slice(19, 23),
            raw: input,
            time: time
        };
        return newobj;
    }
};

var _Force_Exit = function(opt){
    /*
    *   Forces exit. . .
    */
    if (opt === 'user_exit'){
        console.log(chalk.green('\nOkay, you take care now ya hear?\n '));
        process.exit();
    } else if (opt === 'no_files') {
        console.log('\nNo files available in the ./raw directory.  Run ' + chalk.green('"Listen"') + ' to collect data.\n ');
        process.exit();
    }
};


/*
*   Inquirer.js prompt
*   Choose from:
*       Listen
*       Convert
*       Exit
*/
inquirer.prompt([
    {
        type: 'list',
        name: 'os',
        message: 'What OS are you on?',
        choices: [
            'OSX',
            'Windows'
        ]
    },
    {
        type: 'list',
        name: 'what_to_do',
        message: 'What do you want to do?',
        choices: [
            'Listen',
            'Convert',
            'Log Only',
            'Exit'
        ]
    }
], function(answers){

    var a = answers.os;
    if (a === 'OSX') {
        usbDriver = usbOSXDriver;
    } else if (a === 'Windows') {
        usbDriver = usbWindowsDriver;
    }

    var b = answers.what_to_do;
    if (b === 'Listen') {
        _LISTENER._initSerial();
    } else if (b === 'Convert') {
        _PARSER._initParser();
    } else if (b === 'Log Only') {
        logOnly = true;
        _LISTENER._initSerial();
    } else if (b === 'Exit') {
        _Force_Exit('user_exit');
    }
});

// fin