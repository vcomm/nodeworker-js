'use strict';

import FileSaver from 'file-saver'

export default class wProject {
    /* Constructor */
    constructor(name) {
        this._prjname_ = name || 'project'
        this._extension_ = 'dafsm'
    }

    read(file,handle) {
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function() {
          console.log(reader.result);
          if (handle) handle(reader.result);
        };  
        reader.onerror = function() {
          console.log(reader.error);
        };
    }
    save(context) {
        const file = new File([context],`${this._prjname_}.${this._extension_}`,{type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(file);          
    }
}