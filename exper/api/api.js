var getTRO = function(base, art, key) {
    let url = `${base}/api?art=${art}&key=${key}`;
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
};


window.onload = function(){
    els = [...document.getElementsByClassName("elltwo")].forEach(async function(el) {
        base = el.getAttribute('base');
        art = el.getAttribute('art');
        key = el.getAttribute('key');
        let data = await getTRO(base, art, key);
        data = JSON.parse(data)
        let para = document.createElement("div");
        para.classList.add("elltwoCont");
        para.innerHTML = data.text;
        let a = document.createElement('a');
        a.href = `${base}/r/${art}#${key}`;
        a.classList.add("elltwoLink");
        el.appendChild(a).appendChild(para);
    })
}