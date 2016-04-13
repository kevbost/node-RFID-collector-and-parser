#Node RFID Listener / Parser

1. git clone https://github.com/kevbost/node-RFID-collector-and-parser.git
2. `npm install`
3. `node index.js`
4. "Convert"
5. "sample-5000-lines.txt"

When you run `node index.js`, you will get a prompt asking what you want to do.  If you don't have a TRES433 RFID Scanner, then you're out of luck.  If you do happen to have one, change `var networkIp = location.of.networked.scanner` is correct.  Alternatively if you have it plugged in via USB, make sure that `var usbDriver = "path/to/driver"` is correct.  If windows, something like `COM3` should work.

"Listen" opens the connection to the RFID scanner, then appends new data to "current-date-time.txt".
"Convert" presents a list of available raw.txt files.  It will convert the raw.txt file into both .json and .csv files.

fin
