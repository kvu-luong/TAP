$(document).ready(function () {
    $('.bottom_video').slick({
        dots : false,
        arrows : true,
        slidesToShow : 2,
        slidesToScroll : 2,
        autoPlay : false,
        prevArrow:"<img class='a-left control-c prev slick-prev custom-video-button' src='img/video_left_button.svg'>",
        nextArrow:"<img class='a-right control-c next slick-next custom-video-button' src='img/video_right_button.svg'>",
       responsive: [
    {
      breakpoint: 320,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1,
        dots : false,
        arrows : false,
           autoPlay : false,
      }
    },
    {
      breakpoint: 375,
      settings: {
             slidesToShow: 1,
        slidesToScroll: 1,
        dots : false,
        arrows : false,
           autoPlay : false,
      }
    },
    {
      breakpoint: 425,
      settings: {
             slidesToShow: 1,
        slidesToScroll: 1,
        dots : false,
        arrows : false,
           autoPlay : false,
      }
    }

  ]
});

    $('.spotlight_below').slick({
        dots : false,
        arrows : false,
        slidesToShow : 1,
        slidesToScroll : 1,
        autoPlay : false
    });
    
});