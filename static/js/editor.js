
////// UI ///////

//resize text area on input (eliminate scroll)
$(document).on('input', 'textarea', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

active_para = null; // state variable --- takes a para
last_active = null; // state var, to keep track of where cursor was
editable = false; // state variable, are we focused on the active para

makeActive = function(para){
    makeUnEditable();
    $('.para').removeClass('active');
    if(active_para){
    last_active = active_para;
    };
    active_para = para;
    if(active_para){
        para.addClass('active');
    }
}

makeEditable = function(){
    $('.para').removeClass('editable');
    editable = true;
    if(active_para){
        active_para.addClass('editable');
    };
};

makeUnEditable = function(){
    $('.para').removeClass('editable');
    editable = false;
};

//click to make active
$(document).on('click', '.para', function () {
   if(!($(this).hasClass('active'))){
    makeActive($(this));
  };
});

//click background to escape 
$(document).on('click', '#bg', function(){
    if(event.target.id=="bg" || event.target.id=="content"){ 
        makeUnEditable();
        makeActive(null);
    };
});

// focus to make editable
$(document).on('focus', '.p_input', function () {
    makeEditable();
});

//next para
activeNextPara = function(){
  if(active_para){
    next = active_para.next('.para');
    if(next){
    makeActive(next);
  };
  };
}

activePrevPara = function(){
  if(active_para){
    prev = active_para.prev('.para');
    makeActive(prev);
  };
}


/// KEYBOARD NAV

var keymap = {17: false, //ctrl
              13: false, // enter
              38: false, // up
              40: false, // down
              27: false, // esc
};

$(document).keydown(function(e) {
      if (e.keyCode in keymap) {
        keymap[e.keyCode] = true;
        if (!(active_para)){ //if we are inactive
          if (keymap[27]){
            var foc_para = last_active || $('.para').first();
            makeActive(foc_para);
          };
        } else if (active_para&&!(editable)){ // if we are active but not in edit mode
          if(keymap[13]){
            makeEditable();
          } else if (keymap[38]){
            activePrevPara();
          } else if (keymap[40]){
            activeNextPara();
          } else if (keymap[27]){
            makeActive(null);
          };
        } else if (active_para&&editable){ // we are active and editable
          if (keymap[27]){
            makeUnEditable()
          } else if (keymap[17]&&keymap[13]){
            updateFromTextArea(active_para)
            activeNextPara();
          };
        }
      }
    }).keyup(function(e) {
    for (key in keymap) {
        keymap[key] = false;
       // console.log(map);
    }
});

  /// Button Nav

  /// UI editing

// $(document).on('click', '.p_text', function() {
//     var para = $(this).parent();
//     rawToTextArea(para);
// });

$(document).on('click', '.update', function() {
    var para = $(this).parents('.para');
    updateFromTextArea(para);
});

$(document).on('click', '.before', function() {
    var pid = $(this).parents('.para').attr('pid');
    client.sendCommand('insert_before', {'pid': pid});
});

$(document).on('click', '.after', function() {
    var pid = $(this).parents('.para').attr('pid');
    client.sendCommand('insert_after', {'pid': pid});
});

$(document).on('click', '.delete', function() {
    var pid = $(this).parents('.para').attr('pid');
    client.sendCommand('delete_para', {'pid': pid});
});