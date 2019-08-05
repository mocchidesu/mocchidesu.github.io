
/*
 index.js
*/
var PRIVATE_KEY_START = '-----BEGIN PRIVATE KEY-----';
var PRIVATE_KEY_END = '-----END PRIVATE KEY-----';
var PUBLIC_KEY_START = '-----BEGIN PUBLIC KEY-----';
var PUBLIC_KEY_END = '-----END PUBLIC KEY-----';

var DEFAULT_HEADER_MAP = {"Accept": "application/json", "Content-Type": "application/json"};
var CURL_TEMPLATE = "curl -X {0} {1} ";
var CURL_BODY_TEMPLATE = "\\\n -d '{0}' ";
var CURL_HEADER_TEMPLATE = "\\\n -H '{0}: {1}'"


function generateCurlScript(baseUrl, method, body, headerMap) {
    var curlScript = String.format(CURL_TEMPLATE, method, baseUrl);
    // Append header
    var curlHeader = '';
    Object.entries(DEFAULT_HEADER_MAP).forEach(
        header => {curlHeader += String.format(CURL_HEADER_TEMPLATE, header[0], header[1])
    })
    Object.entries(headerMap).forEach(
        header => {curlHeader += String.format(CURL_HEADER_TEMPLATE, header[0], header[1])
    })
    // Append body
    if ("POST" === method || "PUT" === method) {
        curlBody = String.format(CURL_BODY_TEMPLATE, body);
        curlHeader += curlBody
    }
    return curlScript + curlHeader;
}

function epochToDatetime(timestamp) {
    var d = new Date(parseInt(timestamp));
    return d.toString();
}

/**
 * For some reason jsrsasign requires pub/private key string
 * has to include the header and footer starting with "----"
 */
function toRealPem(str, public = false) {
    // cleanup string first.
    str = str.replace(PUBLIC_KEY_END, "")
        .replace(PUBLIC_KEY_START, "")
        .replace(PRIVATE_KEY_END, "")
        .replace(PRIVATE_KEY_START, "")
        .trim()
    console.log("Cleanup Before Process STR to PEm: " + str)
    var ary = chunkString(str, 64);
    var ret = ''
    for (s in ary) {
        ret += ary[s] + '\n'
    }
    var s = public ? PUBLIC_KEY_START : PRIVATE_KEY_START;
    var e = public ? PUBLIC_KEY_END : PRIVATE_KEY_END;
    return `${s}\n${ret.trim()}\n${e}`;
}

/**
 * Support method that cuts string into given length chunks
 * Return array of strings
 */
function chunkString(str, len) {
    var _size = Math.ceil(str.length/len),
        _ret  = new Array(_size),
        _offset
    ;
      for (var _i=0; _i<_size; _i++) {
      _offset = _i * len;
      _ret[_i] = str.substring(_offset, _offset + len);
    }
    return _ret;
}
/**
 * Convert hex represent string to byte array
 */
function hexToBytes(hex_string) {
    for (var bytes = [], c = 0; c < hex_string.length; c += 2)
        bytes.push(parseInt(hex_string.substr(c, 2), 16));
    return bytes;
}

function drop(e) {
    alert("Hey")
    e.preventDefault(); //Prevent the default browser action
    alert("Ho")
   // We accept one file. Additional files are ignored.
   var file=e.originalEvent.dataTransfer.files[0];
   console.log(file);
   var xhr = new XMLHttpRequest(); //Create the upload object
   //Bind a "progress" callback
};


function readTextFile(file) {
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                alert(allText);
            }
        }
    }
    rawFile.send(null);
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

String.format = function (string) {
    var args = Array.prototype.slice.call(arguments, 1, arguments.length);
    return string.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != "undefined" ? args[number] : match;
    });
};