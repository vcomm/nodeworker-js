'use strict';

const bodyParser = require('body-parser')
const express = require('express');
const http = require('http');
const app = express();

const PORT = process.env.PORT || 5000;

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
//const obfuscator = require('javascript-obfuscator');
const adaptive = require('./server/engine')
const engine = new adaptive.aEngine('.././logic/')
engine.init(engine.load(require('./logic/main.json')), engine._cntn_)

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => res.redirect('/api'));

app.get('/version', (req, res) => {
    res.json({ service: `Node Worker version`, responce: `NODE Adaptive Worker API versions 1.0`})            
})

app.get('/evlist', (req, res) => {
    res.json({ service: `Node Worker events list`, responce: engine.emitOn()})            
})

app.post('/attach', (req, res) => {
//    console.log("Node Worker attach dafsm logic :",req.body);
//    res.setHeader('Content-Type', 'application/json'); 
    if (req.body)
        res.json({ service: `Node Worker attach dafsm logic`, responce: engine.load(req.body)})
    else
        res.json({ service: `Node Worker attach dafsm logic`, responce: `Failed: Missing dafsm logic script in request body`})
})

app.delete('/logic/:evname', (req, res) => {   
    res.json({ service: `Node Worker dafsm delete logic by name`, responce: engine.delLogic(req.params.evname)}) 
})

app.get('/logics', (req, res) => {
    res.json({ service: `Node Worker dafsm get logics list`, responce: engine.getLogics()})            
})

app.get('/logics/:sname', (req, res) => {
    res.json({ service: `Node Worker dafsm get logic script by name`, responce: engine.getLogics(req.params.sname)})            
})

app.get('/exec/:evname', (req, res) => {   
    engine.emitEvent(req.params.evname,res)
})

app.post('/create/:evname', (req, res) => {
//    console.log(`Node Worker create new event[${req.params.evname}]:`,req.body);  
    if (req.body && req.body.func)
        res.json({ service: `Node Worker create new event[${req.params.evname}]`, responce: engine.emitOn(req.params.evname,req.body.func)}) 
    else
        res.json({ service: `Node Worker create new event[${req.params.evname}]`, responce: `Failed: Missing request body or/and body.func`})
})

app.delete('/event/:evname', (req, res) => {   
    res.json({ service: `Node Worker remove all listeners by event name`, responce: engine.removeEvent(req.params.evname)}) 
})

var template = 
`<!DOCTYPE html> <html> <body>
<textarea id="code"rows="10" cols="100">
{
"func": "console.debug(': Even drive on: PNETS'); return { status: true };"
}
</textarea>
<br><br>
<button type="button" onclick="codeObfuscate('code')">Attach</button>
<script type="text/javascript">
function codeObfuscate(elem) {
    var code = document.getElementById(elem).value;
    fetch('/create/pnets', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body: code
    })  
        .then(res => res.json())
        .then(resp => {             
            document.getElementById(elem).value = resp.responce
        })
        .catch(console.error.bind(console));
}
</script>
</body> </html>`;
app.get('/test', (req, res) => {
    res.send(template);
});

/*
const bios = {
    fn_tst: new Function('cntx', 'cntx.a = 10; return cntx')
}
const JavaScriptObfuscator = require('javascript-obfuscator');
const obfuscationResult = JavaScriptObfuscator.obfuscate(
    `
    cntx.x = 40;
    cntx.list = [cntx.x,cntx.x*2,cntx.x+10] 
    return cntx;
    `,
    {
        compact: false,
        controlFlowFlattening: true,
        numbersToExpressions: true,
        simplify: true,
        shuffleStringArray: true,
        splitStrings: true
    }
);
bios['fn_my'] = new Function('cntx', obfuscationResult)
*/
const server = http.createServer(app);
server.listen(PORT, (err) => {
    if (err) {
        throw new Error(err);
    }
//    console.error(`Lambda: ${JSON.stringify(bios['fn_my']({}))}`)
    console.log("Node Worker now running on port", server.address());
});