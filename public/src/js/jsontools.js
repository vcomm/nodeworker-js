'use strict';

export default class jsonTools {
    /* Constructor */
    constructor(jsoneditor) {
        this._jsoneditor_ = jsoneditor
    }

    walk(o,func) {
        for (var i in o) {
            func.apply(this,[i,o[i]]);  
            if (o[i] !== null && typeof(o[i])=="object") {
                //going one step down in the object tree!!
                this.walk(o[i],func);
            }
        }
    }

    fnupdate(name,func) {
        let updated = false
        const json = this._jsoneditor_.get()
        this.walk(json,(key,value)=> {
            if (typeof(value)=="object") {
                if (value.hasOwnProperty("name")) {
                    if (value.name === name) {
                        console.info(`Update Function ${name} Body: `,func)
                        value.func = func
                        updated = true
                    }
                }
            }                
        })  
        if (updated) this._jsoneditor_.set(json)
        return updated      
    }

    getFuncByKey(keyname) {
        let funcbody = undefined
        const json = this._jsoneditor_.get()
        this.walk(json,(key,value)=> {
            if (typeof(value)=="object") {
                if (value.hasOwnProperty("name") && 
                    value.hasOwnProperty("func")) {
                    if (value.name === keyname) {
                        return funcbody = value.func
                    }
                }
            }                
        })
        return funcbody         
    }
}