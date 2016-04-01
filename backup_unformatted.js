var serialport          = require("serialport"),
    fs                  = require('fs'),
    net                 = require('net'),
    moment              = require('moment'),
    chalk               = require('chalk'),
    log                 = require('single-line-log').stdout,
    inquirer            = require('inquirer'),
    readline            = require('readline'),
    SerialPort          = serialport.SerialPort,
    client              = new net.Socket(),
    sp                  = new SerialPort("/dev/cu.usbserial-AH000I24", {
                            parser: serialport.parsers.readline("\n"),
                            baudrate: 9600
                        }, false);

var networkIp           = '192.168.1.79',
    // var networkIp    = '192.168.5.59',
    counter             = 0,
    filenameTXT         = './txt/' + moment().format('YYYY-MMM-DD.hh:mm:ss-a') + '.txt',
    obj                 = {records: []},
    filenameJSON        = './json/' + moment().format() + '.json',
    filenameCSV         = './csv/' + moment().format() + '.csv',
    filenameRead;


var _DataSet = function(time, input){
    var newobj = {
        loc: input.slice(0, 4),
        hash: input.slice(4, 16),
        signal: {
            base: input.slice(17, 19),
            first: byteString(parseInt(input.slice(17,18))),
            second: byteString(parseInt(input.slice(18,19)))
        },
        checksum: input.slice(19, 23),
        raw: input,
        time: time
    }
    return newobj
};

var _buildObject = function(input){
    var bufferObject = new _DataSet(input[0], input[1]);
    obj.records.push(bufferObject);
    var csv_builder = bufferObject.loc + "," + bufferObject.hash + "," + bufferObject.signal.base + "," + bufferObject.signal.first + "," + bufferObject.signal.second + "," + bufferObject.checksum + "," + bufferObject.raw + "," + bufferObject.time + "\r\n";
    fs.appendFile(filenameCSV, csv_builder);
}

var _write_JSON = function(json){
    fs.writeFileSync(filenameJSON, json);
}

var _readLines = function(input) {
    readline.createInterface({
        input: fs.createReadStream(input)
    }).on('line', function(line) {
        _buildObject(line.split(','));
    }).on('close', function(line){
        _write_JSON(JSON.stringify(obj));
        console.log('\n' + chalk.green.bold('       Reading From: ') + chalk.yellow(filenameRead));
        console.log(chalk.cyan.bold('Writing to filename: ') + chalk.magenta(filenameJSON) + '\n' +
                    chalk.cyan.bold('Writing to filename: ') + chalk.magenta(filenameCSV));
        console.log(' ')
    });
}


var byteString = function(n) {
  if (n < 0 || n > 255 || n % 1 !== 0) {
      throw new Error(n + " does not fit in a byte");
  }
  return ("000000000" + n.toString(2)).substr(-8)
}

var _initParser = function(){
    files = fs.readdirSync('./txt').reverse();
    inquirer.prompt([
        {
            type: 'list',
            name: 'pick_a_file',
            message: 'Pick a file to parse into JSON && CSV',
            choices: files
        }
    ], function(answer){
        var csvText = "loc, hash, signal.base, signal.first, signal.second, checksum, raw, time\r\n";
        filenameRead = './txt/' + answer.pick_a_file;
        _readLines(filenameRead);
        fs.writeFileSync(filenameCSV, csvText);
    });
}

var _initSerial = function(){
    sp.open(function (error) {
        if ( error ) {
            console.log(chalk.red('\nUSB failed to open: ' + error));
            return _initNetwork();
        } else {
            console.log('\n' + chalk.cyan.bold('Writing to filename: ') + chalk.magenta(filenameTXT) + '\n');
            sp.on('data', function(data) {
                _dispatcher(data);
            });
        }
    });
}

var _initNetwork = function(){
    client.connect(2000, networkIp);
    client.on('error', function(error){
        console.log('No network connection on ' + networkIp);
    });
    client.on('connect', function(error){
        console.log(chalk.green('Great Success!') + '\n' + chalk.cyan.bold('Connected, writing to filename: ') + chalk.magenta(filenameTXT) + '\n');
    });
    client.on('data', function(data){
        return _dispatcher(data);
    });
    client.on('close', function(){
        console.log('Net connection closed');
    });
}

var _dispatcher = function(input){
    counter++;
    if(counter <= 2){
        return;
    } else {
        return _removeSpecialCharacters(input);
    }
}

var _removeSpecialCharacters = function(input){
    var buffer = input.toString().split('');
    input.toString().split('')
        .map(function(l){
        if(l == "\n" || l == "\r"){
            buffer.splice(buffer.indexOf(l), 1);
        }
    });
    return _appendToFile(buffer.join(''));
}

var _appendToFile = function(input){
    var inputPlusTime = moment().format("HH:mm:ss.SSS") + "," + input + '\n';
    log.clear()
    log(chalk.yellow(counter) + ': ' + inputPlusTime);
    fs.appendFile(filenameTXT, inputPlusTime);
}


inquirer.prompt([
    {
        type: 'list',
        name: 'what_to_do',
        message: 'What do you want to do?',
        choices: [
            'Listen',
            'Convert',
            'Exit'
        ]
    }
], function(answers){
    if (answers.what_to_do === 'Listen') {
        _initSerial('text');
    } else if (answers.what_to_do === 'Convert') {
        _initParser();
    }
});

