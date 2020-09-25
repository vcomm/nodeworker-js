'use strict';

export default class wStorage {
    /* Constructor */
    constructor(type,key,cblk) {
        this._key_ = key;
        this._cblk_ = cblk ? cblk : null;
        this._storage_ = type ? window.localStorage : window.sessionStorage;      
    }
    init() {
        const self = this
        window.onstorage = (e) => {
            // When local storage changes, dump the list to the console.  
            console.log('The ' + e.key +
            ' key has been changed from ' + e.oldValue +
            ' to ' + e.newValue + '.');  

//            const data = this._storage_.getItem(this._key_);
            if (self._cblk_) self._cblk_(e.newValue)            
        };          
    }

    set(value,key) {
        this._storage_.setItem(key ? key : this._key_, value)
    }

    get(key) {
        return this._storage_.getItem(key ? key : this._key_)
    }

    retrive(cblk) {
        return Object.keys(this._storage_).map((key) => {
            return cblk(key,this.get(key))
        })
    }

    remove(key) {
        this._storage_.removeItem(key ? key : this._key_)
    }

    clear() {
        this._storage_.clear()
    }
}