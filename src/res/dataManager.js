var KEY_GET_IMAGE = new Uint8Array([71,73,77,71]); //ascii: "GIMG"
var KEY_GET_NEXT_TILE = new Uint8Array([71,78,88,84]); //ascii: "GNXT"
var KEY_SET_CURSOR_POS = new Uint8Array([83,67,85,80]); //SCUP
var KEY_SET_CURSOR_DELTA = new Uint8Array([83,67,85,68]); //SCUD
var KEY_SET_MOUSE_KEY = new Uint8Array([83,77,75,83]); //SMKS
var KEY_SET_MOUSE_WHEEL = new Uint8Array([83,77,87,72]); //SMWH
var KEY_SET_KEY_STATE = new Uint8Array([83,75,83,84]); //"SKST";
var KEY_CHANGE_DISPLAY = new Uint8Array([67,72,68,80]); //"CHDP";
var KEY_DEBUG = new Uint8Array([68,66,85,71]); //"DBUG";

var KEY_IMAGE_PARAM = "73,77,71,80";//new Uint8Array([73,77,71,80]); //ascii: "IMGP";
var KEY_IMAGE_TILE = "73,77,71,84";//IMGT
var KEY_SET_LAST_TILE = "83,76,83,84";//SLST

var COMMAD_SIZE = 4;
var REQUEST_MIN_SIZE = 6;

class DataManager
{    
    constructor()
    {
        this.id = "123";
        
        this.isConnected = false;
        
        this.startSocket();
        
        this.startXmlHttpRequest();
        
        this.dataTmp = new Uint8Array([]);
        
        this.imageWidth = 1920;
        this.imageHeight = 1280;
        this.rectWidth = 100;
        
        this.displayField = null;
        this.canvas = null;
        this.ctx = null;
    }
    
    startSocket()
    {
        this.webSocket = new WebSocket('ws://' + window.location.hostname + ':8081/');
        
        if(!this.webSocket)
            return;
        
        this.webSocket.onopen = this.socketConnected();
        this.webSocket.onmessage = this.setData.bind(this);
    }
    
    startSession()
    {
        if(this.webSocket)
        {
            if(this.webSocket.readyState === WebSocket.OPEN)
            {
                this.isConnected = true;
                
                this.webSocket.binaryType = 'arraybuffer';
                this.webSocket.send(KEY_GET_IMAGE);
            }
        }
    }
    
    socketConnected()
    {
        setTimeout(this.startSession.bind(this),1000);
    }
    
    setData(event)
    {
        var data = event.data;

        var dataArray = new Uint8Array(data);
        var activeBuf = new Uint8Array(dataArray.length + this.dataTmp.length);
        activeBuf.set(this.dataTmp, 0);
        activeBuf.set(dataArray, this.dataTmp.length);

        var size = activeBuf.length;

        if(size < REQUEST_MIN_SIZE)
            return;

        var dataStep = 0;

        for(var i=0;i<size;++i)
        {
            var command = activeBuf.subarray(dataStep, dataStep+COMMAD_SIZE);
            var dataSize = this.uint16FromArray(activeBuf.subarray(dataStep + COMMAD_SIZE, dataStep + COMMAD_SIZE + 2));

            if(size >= (dataStep + COMMAD_SIZE + 2 + dataSize))
            {
                var payload = activeBuf.subarray(dataStep + COMMAD_SIZE + 2, dataStep + COMMAD_SIZE + 2 + dataSize);
                dataStep += COMMAD_SIZE + 2 + dataSize;

                this.newData(command,payload);
 
                i = dataStep;
            }
            else
            {
                this.dataTmp = activeBuf.subarray(dataStep, dataStep + (size - dataStep));
                break;
            }
        }
    }
    
    newData(cmd, data)
    {
        if(cmd.length !== 4)
            return;

        var command = cmd.toString();

        if(command === KEY_IMAGE_PARAM)
        {
            this.imageWidth = this.uint16FromArray(data.subarray(0,2));
            this.imageHeight = this.uint16FromArray(data.subarray(2,4));
            this.rectWidth = this.uint16FromArray(data.subarray(4,6));
            
            if(this.canvas)
            {
                this.canvas.width = this.imageWidth;
                this.canvas.height = this.imageHeight;
                
                if(this.displayField)
                    this.displayField.updateSizes();
            }
        }
        else if(command === KEY_IMAGE_TILE)
        {
            var posX = this.uint16FromArray(data.subarray(0,2));
            var posY = this.uint16FromArray(data.subarray(2,4));

            var rawData = data.subarray(4,data.length);
            var b64encoded = btoa(String.fromCharCode.apply(null, rawData));

            var image = new Image();
            image.posX = posX * this.rectWidth;
            image.posY = posY * this.rectWidth;
            image.ctx = this.ctx;
            image.width = this.rectWidth;
            image.height = this.rectWidth;

            image.onload = function(){this.ctx.drawImage(this, this.posX, this.posY, this.width, this.height);}

            var base64Png = 'data:image/png;base64,';
            base64Png += b64encoded;
            image.src = base64Png;
        }
        else console.log("newData:",command.toString(),command,data);
    }
    
    sendToSocket(data)
    {
        if(this.isConnected)
        {
            this.webSocket.binaryType = 'arraybuffer';
            this.webSocket.send(data);
        }
        else console.log("try 'sendToSocket' but socket is not connected yet");
    }

    sendTextToSocket(text)
    {
        if(this.isConnected)
        {
            this.webSocket.binaryType = 'blob';
            this.webSocket.send(text);
        }
    }
    
    setDisplayField(dField)
    {
        if(dField)
        {
            this.displayField = dField;
            this.canvas = dField.getCanvas();
            this.ctx = canvas.getContext('2d');
            dField.setDataManager(this);
        }
    }
    
    sendParameters(key, param1, param2)
    {
        var posSize = this.arrayFromUint16(4);
        var posXBuf = this.arrayFromUint16(param1);
        var posYBuf = this.arrayFromUint16(param2);

        var buf = new Uint8Array(10);
        buf[0] = key[0];
        buf[1] = key[1];
        buf[2] = key[2];
        buf[3] = key[3];
        buf[4] = posSize[0];
        buf[5] = posSize[1];
        buf[6] = posXBuf[0];
        buf[7] = posXBuf[1];
        buf[8] = posYBuf[0];
        buf[9] = posYBuf[1];

//        this.sendToSocket(buf);
    }
    
    uint16FromArray(buf)
    {
        if(buf.length === 2)
        {
            var number = buf[0] | buf[1] << 8;
            return number;
        }
        else return 0x0000;
    }

    arrayFromUint16(num)
    {
        var buf = new Uint8Array(2);
        buf[0] = num;
        buf[1] = num >> 8;
        return buf;
    }
    
    // ________________ XMLHttpRequest ________________
    startXmlHttpRequest()
    {
        this.xmlHttpRequest = new XMLHttpRequest();
        this.xmlHttpRequest.onload = this.readFromXmlHttpRequest.bind(this);
    }

    readFromXmlHttpRequest()
    {
        var data = this.xmlHttpRequest.responseText;
        
        console.log("readFromXmlHttpRequest:", data);
    }

    sendToXmlHttpRequest(method, request, data)
    {
        this.xmlHttpRequest.open(method, request);
        this.xmlHttpRequest.send(data);
    }
    // ________________________________________________
}