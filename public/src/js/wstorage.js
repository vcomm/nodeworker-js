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

    set(value) {
        this._storage_.setItem(this._key_, value)
    }

    get() {
        return this._storage_.getItem(this._key_)
    }

    remove() {
        this._storage_.removeItem(this._key_)
    }

    clear() {
        this._storage_.clear()
    }
}