jQuery(document).ready(function ($) {

  //remove equal_col class
  let browserSize = $(window).width();
  if(browserSize <= 768  ){

    $(".row").removeClass("equal_col");
    $(".opinion_remove_equal").removeClass("equal_col");
    $(".container").removeClass("equal_col");
  }
  if(browserSize <= 414){
    $(".events-section").removeClass("equal_col");
  }
  let rightLimit = 83;
  // let leftLimit = 15;//initial left position
  // $(window).on("scroll", function(){
  //   let heighScroll = $(window).scrollTop();
  //   if(heighScroll > 0 && heighScroll <= 1240){
  //     moveRight(object, top, heighScroll, 1240);
  //   }else if( heighScroll > 1240 && heighScroll <= 1960){
  //     let depth = 46.8;
  //     moveDownRight(object, rightLimit, depth, heighScroll, 1240, 1960);
  //   }else if (heighScroll > 1960 && heighScroll <= 2160){
  //     let topLimit = 23.6;
  //     moveLeft(object, topLimit, heighScroll, 1960, 2160);
  //   }
  // })
  
  //get scrollable 
  let windowHeight = $(window).height();

  let object = $(".box_animation");
  let geoHeight = parseInt($(".geopolitics").innerHeight());
  let marketHeight = parseInt($(".markets").innerHeight());
  let enerHeight = parseInt($(".energy").innerHeight());
  let techHeight = parseInt($(".technology").innerHeight());
  let videoHeight = parseInt($(".video").innerHeight());
  let beltHeight = parseInt($(".beltRoad").innerHeight());
  let conHeight = parseInt($(".comsumer").innerHeight());
  let fanHeight = parseInt($(".fan360").innerHeight());
  let uniHeight = parseInt($(".unicorns").innerHeight());
  let opiHeight = parseInt($(".opinion").innerHeight());

  let right = parseInt($(".geopolitics").innerWidth());
  let left = parseInt($(".box_animation").css("left"));//initial left position
  let top = parseInt($(".box_animation").css("top")); //initial top position;
  let botGeo = top + geoHeight + 50;
  let botMarket = botGeo + marketHeight;
  let botEng = botMarket + enerHeight;
  let botTech = botEng  + techHeight + 15;
  let botVideo = botTech + videoHeight + 263;//to become 4210 px
  let botBelt = botVideo + beltHeight;
  let botConsumer = botBelt + conHeight;
  let botFan = botConsumer + fanHeight;
  let botUni = botFan + uniHeight;
  let botOpi = botUni + opiHeight;


// $(window).bind('mousewheel scroll', function(event) {
//     if (event.originalEvent.wheelDelta >= 0) {
//       let height = $(window).scrollTop();
//         console.log(height + "scroll up");
//         if(height >= 600 && height <= 1300){
//           moveLeft(object, right, left);
//         }
//         if( height > 1300 && height <= 1900){//geo
//           moveUpRight(object, top, botGeo, right);
//         }
//         if(height > 1900 && height <= 2200){
//           moveRight(object, right, left);
//         }
//         if(height > 2200 && height <= 2500){//market
//           moveUpLeft(object, botGeo, botMarket , left );
//         }
//         if(height > 2500 && height <= 2800){
//           moveLeft(object, right, left);
//         }
       
       
//     }
//     else {    
//       let height = $(window).scrollTop();
//         console.log(height + "scroll dow");
//         if(height >= 600 && height <= 1300){
//           moveRight(object, right, top);
//         }
//         if( height > 1300 && height <= 1900){//geo
//           moveDownRight(object, top, botGeo, right);
//         }
//         if(height > 1900 && height <= 2200){
//           moveLeft(object, right, left, botGeo);
//         }
//         if(height > 2200 && height <= 2580){//market
//           moveDownLeft(object, botGeo, botMarket , left );
//         }
//         if(height > 2580 && height <= 2800){
//           moveRight(object, right, botMarket);
//         }
//         if(height > 2800 && height <= 3200){ //energy
//           moveDownRight(object, botMarket, botEng, right);
//         }
//         if(height > 3200 && height <= 3500){
//           moveLeft(object, right, left, botEng);
//         }
//         if(height > 3500 && height <= 3800){//technology
//           moveDownLeft(object, botEng, botTech, left);
//         }
//         if(height > 3800 && height <= 4100){
//           moveRight(object, right, botTech);
//         }
//         if(height > 4100 && height <= 4500){//video
//           moveDownRight(object, botTech, botVideo, right);
//         }
//         if(height > 4500 && height <= 4780){
//           moveLeft(object, right, left, botVideo);
//         }
//         if(height > 4780 && height <= 5200){//belt
//           moveDownLeft(object, botVideo, botBelt, left);
//         }
//         if(height > 5200 && height <= 5495){
//           moveRight(object, right, botBelt);
//         }
//         if(height > 5495 && height <= 5890){//consumer
//           moveDownRight(object, botBelt, botConsumer , right)
//         }
//         if(height > 5890 && height <= 5995){
//           moveLeft(object, right, left, botConsumer);
//         }
//         if(height > 5995 && height <= 6495){//fan
//           moveDownLeft(object, botConsumer, botFan, left);
//         }
//         if(height > 6495 && height <= 6790){
//           moveRight(object, right, botFan);
//         }
//         if(height > 6790 && height <= 7120){//unicorns
//           moveDownRight(object, botFan, botUni, right);
//         }
//         if(height > 7120 && height <= 7400){
//           moveLeft(object, right, left, botUni);
//         }
//         if(height > 7400){//opinion
//           moveDownLeft(object, botUni, botOpi, left);
//         } 
       
//     }
// });

function moveRight(object, topPosition, heighScroll, limit){
  let incresePixel = heighScroll * 100 / limit;
  //rotate object
  $('#object_box').removeClass('rotateBox');
  $('#object_box').addClass('rotateBox_Origin');
  //check left position

  let initalLeftPosition = parseInt(object.css("left"));

  initalLeftPosition = incresePixel;
  if(initalLeftPosition > 83){
    initalLeftPosition = 83;
  }
  object.css({
    "left": initalLeftPosition +"%",
    "top": topPosition
  });
}

function moveLeft(object, topLimit, heighScroll, topLimit, botLimit){
  let incresePixel = (heighScroll - topLimit) * 100 / (botLimit - topLimit);
  //rotate object
  $('#object_box').removeClass('rotateBox');
  $('#object_box').addClass('rotateBox_Origin');
  //check left position

  let rightLimit = parseInt($("#object_box").css("left"));
  console.log(rightLimit + "check left position to calulate percent");
  let initalLeftPosition ;
  if(rightLimit !== 1420.03){
    initalLeftPosition = (rightLimit * 83 / 1420.03) - incresePixel;
  }else{
    initalLeftPosition = 83;
  }
  
  
  if(initalLeftPosition < 15){
    initalLeftPosition = 15;
  }
  console.log(initalLeftPosition + "after minus");
  object.css({
    "left": initalLeftPosition +"%",
    "top": topLimit +"%"
  });
}
function moveDownRight(object, right,depth, heighScroll,topLimit, botLimit){
  let incresePixel = (heighScroll - topLimit) * 100 / (botLimit - topLimit);
  //rotate object
  $('#object_box').removeClass('rotateBox_Origin');
  $('#object_box').addClass('rotateBox');

  //check top position
  let initalHeight = parseInt(object.css("top"));
 
  initalHeight = initalHeight +  incresePixel;
  if(initalHeight > depth){
    initalHeight = depth;
  }
  object.css({
    "top": initalHeight + "%",
    "left": right + "%"
  });
}
function moveUpRight(object, top, bottom, right){
  //rotate object
  $('#object_box').removeClass('rotateBox_Origin');
  $('#object_box').addClass('rotateBox');
  //check top position
  let maxRight = right + 245;
  let initalHeight = parseInt(object.css("top"));
  let height = bottom - top;
  initalHeight -= height /3;
  if(initalHeight < top){
    initalHeight = top;
  }
  object.css({
    "top":initalHeight + "px",
    "left": maxRight
  });
}

function moveDownLeft(object, left, heighScroll,topLimit, botLimit){
  let incresePixel = (heighScroll - topLimit) * 100 / (botLimit - topLimit);
  //rotate object
  $('#object_box').removeClass('rotateBox_Origin');
  $('#object_box').addClass('rotateBox');

  //check top position
  let initalHeight = parseInt(object.css("top"));
 
  initalHeight = incresePixel;
  if(initalHeight > 46.8){
    initalHeight = 46.8;
  }
  object.css({
    "top": initalHeight + "%",
    "left": left
  });
}
function moveUpLeft(object, top, bottom, left){
  //rotate object
  $('#object_box').removeClass('rotateBox_Origin');
  $('#object_box').addClass('rotateBox');
  //check top position
  let initalHeight = parseInt(object.css("top"));
  let height = bottom - top;
  initalHeight -= height /3;
  if(initalHeight < top){
    initalHeight = top;
  }
  object.css({
    "top": initalHeight + "px",
    "left": left
  });
}

})

