(function ($, document, window) {
      var
      // Default settings object.
      // See http://jacklmoore.com/colorbox for details.
      defaults = {
          // data sources
          html: false,
          photo: false,
          iframe: false,
          inline: false,
  
          // behavior and appearance
          transition: "elastic",
          speed: 300,
          fadeOut: 300,
          width: false,
          initialWidth: "600",
          innerWidth: false,
          maxWidth: false,
          height: false,
          initialHeight: "450",
          innerHeight: false,
          maxHeight: false,
          scalePhotos: true,
          scrolling: true,
          opacity: 0.9,
          preloading: true,
          className: false,
          overlayClose: true,
          escKey: true,
          arrowKey: true,
          top: false,
          bottom: false,
          left: false,
          right: false,
          fixed: false,
          data: undefined,
          closeButton: true,
          fastIframe: true,
          open: false,
          reposition: true,
          loop: true,
          slideshow: false,
          slideshowAuto: true,
          slideshowSpeed: 2500,
          slideshowStart: "start slideshow",
          slideshowStop: "stop slideshow",
          photoRegex: /\.(gif|png|jp(e|g|eg)|bmp|ico|webp|jxr|svg)((#|\?).*)?$/i,
  
          // alternate image paths for high-res displays
          retinaImage: false,
          retinaUrl: false,
          retinaSuffix: '@2x.$1',
  
          // internationalization
          current: "image {current} of {total}",
          previous: "previous",
          next: "next",
          close: "close",
          xhrError: "This content failed to load.",
          imgError: "This image failed to load.",
  
          // accessbility
          returnFocus: true,
          trapFocus: true,
  
          // callbacks
          onOpen: false,
          onLoad: false,
          onComplete: false,
          onCleanup: false,
          onClosed: false,
  
          rel: function() {
              return this.rel;
          },
          href: function() {
              // using this.href would give the absolute url, when the href may have been inteded as a selector (e.g. '#container')
              return $(this).attr('href');
          },
          title: function() {
              return this.title;
          }
      },
  
      // Abstracting the HTML and event identifiers for easy rebranding
      colorbox = 'colorbox',
      prefix = 'cbox',
      boxElement = prefix + 'Element',
      
      // Events
      event_open = prefix + '_open',
      event_load = prefix + '_load',
      event_complete = prefix + '_complete',
      event_cleanup = prefix + '_cleanup',
      event_closed = prefix + '_closed',
      event_purge = prefix + '_purge',
  
      // Cached jQuery Object Variables
      $overlay,
      $box,
      $wrap,
      $content,
      $topBorder,
      $leftBorder,
      $rightBorder,
      $bottomBorder,
      $related,
      $window,
      $loaded,
      $loadingBay,
      $loadingOverlay,
      $title,
      $current,
      $slideshow,
      $next,
      $prev,
      $close,
      $groupControls,
      $events = $('<a/>'), // $({}) would be prefered, but there is an issue with jQuery 1.4.2
      
      // Variables for cached values or use across multiple functions
      settings,
      interfaceHeight,
      interfaceWidth,
      loadedHeight,
      loadedWidth,
      index,
      photo,
      open,
      active,
      closing,
      loadingTimer,
      publicMethod,
      div = "div",
      requests = 0,
      previousCSS = {},
      init;
  
      // ****************
      // HELPER FUNCTIONS
      // ****************
      
      // Convenience function for creating new jQuery objects
      function $tag(tag, id, css) {
          var element = document.createElement(tag);
  
          if (id) {
              element.id = prefix + id;
          }
  
          if (css) {
              element.style.cssText = css;
          }
  
          return $(element);
      }
      
      // Get the window height using innerHeight when available to avoid an issue with iOS
      // http://bugs.jquery.com/ticket/6724
      function winheight() {
          return window.innerHeight ? window.innerHeight : $(window).height();
      }
  
      function Settings(element, options) {
          if (options !== Object(options)) {
              options = {};
          }
  
          this.cache = {};
          this.el = element;
  
          this.value = function(key) {
              var dataAttr;
  
              if (this.cache[key] === undefined) {
                  dataAttr = $(this.el).attr('data-cbox-'+key);
  
                  if (dataAttr !== undefined) {
                      this.cache[key] = dataAttr;
                  } else if (options[key] !== undefined) {
                      this.cache[key] = options[key];
                  } else if (defaults[key] !== undefined) {
                      this.cache[key] = defaults[key];
                  }
              }
  
              return this.cache[key];
          };
  
          this.get = function(key) {
              var value = this.value(key);
              return $.isFunction(value) ? value.call(this.el, this) : value;
          };
      }
  
      // Determine the next and previous members in a group.
      function getIndex(increment) {
          var
          max = $related.length,
          newIndex = (index + increment) % max;
          
          return (newIndex < 0) ? max + newIndex : newIndex;
      }
  
      // Convert '%' and 'px' values to integers
      function setSize(size, dimension) {
          return Math.round((/%/.test(size) ? ((dimension === 'x' ? $window.width() : winheight()) / 100) : 1) * parseInt(size, 10));
      }
      
      // Checks an href to see if it is a photo.
      // There is a force photo option (photo: true) for hrefs that cannot be matched by the regex.
      function isImage(settings, url) {
          return settings.get('photo') || settings.get('photoRegex').test(url);
      }
  
      function retinaUrl(settings, url) {
          return settings.get('retinaUrl') && window.devicePixelRatio > 1 ? url.replace(settings.get('photoRegex'), settings.get('retinaSuffix')) : url;
      }
  
      function trapFocus(e) {
          if ('contains' in $box[0] && !$box[0].contains(e.target) && e.target !== $overlay[0]) {
              e.stopPropagation();
              $box.focus();
          }
      }
  
      function setClass(str) {
          if (setClass.str !== str) {
              $box.add($overlay).removeClass(setClass.str).addClass(str);
              setClass.str = str;
          }
      }
  
      function getRelated(rel) {
          index = 0;
          
          if (rel && rel !== false && rel !== 'nofollow') {
              $related = $('.' + boxElement).filter(function () {
                  var options = $.data(this, colorbox);
                  var settings = new Settings(this, options);
                  return (settings.get('rel') === rel);
              });
              index = $related.index(settings.el);
              
              // Check direct calls to Colorbox.
              if (index === -1) {
                  $related = $related.add(settings.el);
                  index = $related.length - 1;
              }
          } else {
              $related = $(settings.el);
          }
      }
  
      function trigger(event) {
          // for external use
          $(document).trigger(event);
          // for internal use
          $events.triggerHandler(event);
      }
  
      var slideshow = (function(){
          var active,
              className = prefix + "Slideshow_",
              click = "click." + prefix,
              timeOut;
  
          function clear () {
              clearTimeout(timeOut);
          }
  
          function set() {
              if (settings.get('loop') || $related[index + 1]) {
                  clear();
                  timeOut = setTimeout(publicMethod.next, settings.get('slideshowSpeed'));
              }
          }
  
          function start() {
              $slideshow
                  .html(settings.get('slideshowStop'))
                  .unbind(click)
                  .one(click, stop);
  
              $events
                  .bind(event_complete, set)
                  .bind(event_load, clear);
  
              $box.removeClass(className + "off").addClass(className + "on");
          }
  
          function stop() {
              clear();
              
              $events
                  .unbind(event_complete, set)
                  .unbind(event_load, clear);
  
              $slideshow
                  .html(settings.get('slideshowStart'))
                  .unbind(click)
                  .one(click, function () {
                      publicMethod.next();
                      start();
                  });
  
              $box.removeClass(className + "on").addClass(className + "off");
          }
  
          function reset() {
              active = false;
              $slideshow.hide();
              clear();
              $events
                  .unbind(event_complete, set)
                  .unbind(event_load, clear);
              $box.removeClass(className + "off " + className + "on");
          }
  
          return function(){
              if (active) {
                  if (!settings.get('slideshow')) {
                      $events.unbind(event_cleanup, reset);
                      reset();
                  }
              } else {
                  if (settings.get('slideshow') && $related[1]) {
                      active = true;
                      $events.one(event_cleanup, reset);
                      if (settings.get('slideshowAuto')) {
                          start();
                      } else {
                          stop();
                      }
                      $slideshow.show();
                  }
              }
          };
  
      }());
  
  
      function launch(element) {
          var options;
  
          if (!closing) {
  
              options = $(element).data(colorbox);
  
              settings = new Settings(element, options);
              
              getRelated(settings.get('rel'));
  
              if (!open) {
                  open = active = true; // Prevents the page-change action from queuing up if the visitor holds down the left or right keys.
  
                  setClass(settings.get('className'));
                  
                  // Show colorbox so the sizes can be calculated in older versions of jQuery
                  $box.css({visibility:'hidden', display:'block', opacity:''});
                  
                  $loaded = $tag(div, 'LoadedContent', 'width:0; height:0; overflow:hidden; visibility:hidden');
                  $content.css({width:'', height:''}).append($loaded);
  
                  // Cache values needed for size calculations
                  interfaceHeight = $topBorder.height() + $bottomBorder.height() + $content.outerHeight(true) - $content.height();
                  interfaceWidth = $leftBorder.width() + $rightBorder.width() + $content.outerWidth(true) - $content.width();
                  loadedHeight = $loaded.outerHeight(true);
                  loadedWidth = $loaded.outerWidth(true);
  
                  // Opens inital empty Colorbox prior to content being loaded.
                  var initialWidth = setSize(settings.get('initialWidth'), 'x');
                  var initialHeight = setSize(settings.get('initialHeight'), 'y');
                  var maxWidth = settings.get('maxWidth');
                  var maxHeight = settings.get('maxHeight');
  
                  settings.w = (maxWidth !== false ? Math.min(initialWidth, setSize(maxWidth, 'x')) : initialWidth) - loadedWidth - interfaceWidth;
                  settings.h = (maxHeight !== false ? Math.min(initialHeight, setSize(maxHeight, 'y')) : initialHeight) - loadedHeight - interfaceHeight;
  
                  $loaded.css({width:'', height:settings.h});
                  publicMethod.position();
  
                  trigger(event_open);
                  settings.get('onOpen');
  
                  $groupControls.add($title).hide();
  
                  $box.focus();
                  
                  if (settings.get('trapFocus')) {
                      // Confine focus to the modal
                      // Uses event capturing that is not supported in IE8-
                      if (document.addEventListener) {
  
                          document.addEventListener('focus', trapFocus, true);
                          
                          $events.one(event_closed, function () {
                              document.removeEventListener('focus', trapFocus, true);
                          });
                      }
                  }
  
                  // Return focus on closing
                  if (settings.get('returnFocus')) {
                      $events.one(event_closed, function () {
                          $(settings.el).focus();
                      });
                  }
              }
  
              var opacity = parseFloat(settings.get('opacity'));
              $overlay.css({
                  opacity: opacity === opacity ? opacity : '',
                  cursor: settings.get('overlayClose') ? 'pointer' : '',
                  visibility: 'visible'
              }).show();
              
              if (settings.get('closeButton')) {
                  $close.html(settings.get('close')).appendTo($content);
              } else {
                  $close.appendTo('<div/>'); // replace with .detach() when dropping jQuery < 1.4
              }
  
              load();
          }
      }
  
      // Colorbox's markup needs to be added to the DOM prior to being called
      // so that the browser will go ahead and load the CSS background images.
      function appendHTML() {
          if (!$box) {
              init = false;
              $window = $(window);
              $box = $tag(div).attr({
                  id: colorbox,
                  'class': $.support.opacity === false ? prefix + 'IE' : '', // class for optional IE8 & lower targeted CSS.
                  role: 'dialog',
                  tabindex: '-1'
              }).hide();
              $overlay = $tag(div, "Overlay").hide();
              $loadingOverlay = $([$tag(div, "LoadingOverlay")[0],$tag(div, "LoadingGraphic")[0]]);
              $wrap = $tag(div, "Wrapper");
              $content = $tag(div, "Content").append(
                  $title = $tag(div, "Title"),
                  $current = $tag(div, "Current"),
                  $prev = $('<button type="button"/>').attr({id:prefix+'Previous'}),
                  $next = $('<button type="button"/>').attr({id:prefix+'Next'}),
                  $slideshow = $tag('button', "Slideshow"),
                  $loadingOverlay
              );
  
              $close = $('<button type="button"/>').attr({id:prefix+'Close'});
              
              $wrap.append( // The 3x3 Grid that makes up Colorbox
                  $tag(div).append(
                      $tag(div, "TopLeft"),
                      $topBorder = $tag(div, "TopCenter"),
                      $tag(div, "TopRight")
                  ),
                  $tag(div, false, 'clear:left').append(
                      $leftBorder = $tag(div, "MiddleLeft"),
                      $content,
                      $rightBorder = $tag(div, "MiddleRight")
                  ),
                  $tag(div, false, 'clear:left').append(
                      $tag(div, "BottomLeft"),
                      $bottomBorder = $tag(div, "BottomCenter"),
                      $tag(div, "BottomRight")
                  )
              ).find('div div').css({'float': 'left'});
              
              $loadingBay = $tag(div, false, 'position:absolute; width:9999px; visibility:hidden; display:none; max-width:none;');
              
              $groupControls = $next.add($prev).add($current).add($slideshow);
          }
          if (document.body && !$box.parent().length) {
              $(document.body).append($overlay, $box.append($wrap, $loadingBay));
          }
      }
  
      // Add Colorbox's event bindings
      function addBindings() {
          function clickHandler(e) {
              // ignore non-left-mouse-clicks and clicks modified with ctrl / command, shift, or alt.
              // See: http://jacklmoore.com/notes/click-events/
              if (!(e.which > 1 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  launch(this);
              }
          }
  
          if ($box) {
              if (!init) {
                  init = true;
  
                  // Anonymous functions here keep the public method from being cached, thereby allowing them to be redefined on the fly.
                  $next.click(function () {
                      publicMethod.next();
                  });
                  $prev.click(function () {
                      publicMethod.prev();
                  });
                  $close.click(function () {
                      publicMethod.close();
                  });
                  $overlay.click(function () {
                      if (settings.get('overlayClose')) {
                          publicMethod.close();
                      }
                  });
                  
                  // Key Bindings
                  $(document).bind('keydown.' + prefix, function (e) {
                      var key = e.keyCode;
                      if (open && settings.get('escKey') && key === 27) {
                          e.preventDefault();
                          publicMethod.close();
                      }
                      if (open && settings.get('arrowKey') && $related[1] && !e.altKey) {
                          if (key === 37) {
                              e.preventDefault();
                              $prev.click();
                          } else if (key === 39) {
                              e.preventDefault();
                              $next.click();
                          }
                      }
                  });
  
                  if ($.isFunction($.fn.on)) {
                      // For jQuery 1.7+
                      $(document).on('click.'+prefix, '.'+boxElement, clickHandler);
                  } else {
                      // For jQuery 1.3.x -> 1.6.x
                      // This code is never reached in jQuery 1.9, so do not contact me about 'live' being removed.
                      // This is not here for jQuery 1.9, it's here for legacy users.
                      $('.'+boxElement).live('click.'+prefix, clickHandler);
                  }
              }
              return true;
          }
          return false;
      }
  
      // Don't do anything if Colorbox already exists.
      if ($[colorbox]) {
          return;
      }
  
      // Append the HTML when the DOM loads
      $(appendHTML);
  
  
      // ****************
      // PUBLIC FUNCTIONS
      // Usage format: $.colorbox.close();
      // Usage from within an iframe: parent.jQuery.colorbox.close();
      // ****************
      
      publicMethod = $.fn[colorbox] = $[colorbox] = function (options, callback) {
          var settings;
          var $obj = this;
  
          options = options || {};
  
          if ($.isFunction($obj)) { // assume a call to $.colorbox
              $obj = $('<a/>');
              options.open = true;
          } else if (!$obj[0]) { // colorbox being applied to empty collection
              return $obj;
          }
  
  
          if (!$obj[0]) { // colorbox being applied to empty collection
              return $obj;
          }
          
          appendHTML();
  
          if (addBindings()) {
  
              if (callback) {
                  options.onComplete = callback;
              }
  
              $obj.each(function () {
                  var old = $.data(this, colorbox) || {};
                  $.data(this, colorbox, $.extend(old, options));
              }).addClass(boxElement);
  
              settings = new Settings($obj[0], options);
              
              if (settings.get('open')) {
                  launch($obj[0]);
              }
          }
          
          return $obj;
      };
  
      publicMethod.position = function (speed, loadedCallback) {
          var
          css,
          top = 0,
          left = 0,
          offset = $box.offset(),
          scrollTop,
          scrollLeft;
          
          $window.unbind('resize.' + prefix);
  
          // remove the modal so that it doesn't influence the document width/height
          $box.css({top: -9e4, left: -9e4});
  
          scrollTop = $window.scrollTop();
          scrollLeft = $window.scrollLeft();
  
          if (settings.get('fixed')) {
              offset.top -= scrollTop;
              offset.left -= scrollLeft;
              $box.css({position: 'fixed'});
          } else {
              top = scrollTop;
              left = scrollLeft;
              $box.css({position: 'absolute'});
          }
  
          // keeps the top and left positions within the browser's viewport.
          if (settings.get('right') !== false) {
              left += Math.max($window.width() - settings.w - loadedWidth - interfaceWidth - setSize(settings.get('right'), 'x'), 0);
          } else if (settings.get('left') !== false) {
              left += setSize(settings.get('left'), 'x');
          } else {
              left += Math.round(Math.max($window.width() - settings.w - loadedWidth - interfaceWidth, 0) / 2);
          }
          
          if (settings.get('bottom') !== false) {
              top += Math.max(winheight() - settings.h - loadedHeight - interfaceHeight - setSize(settings.get('bottom'), 'y'), 0);
          } else if (settings.get('top') !== false) {
              top += setSize(settings.get('top'), 'y');
          } else {
              top += Math.round(Math.max(winheight() - settings.h - loadedHeight - interfaceHeight, 0) / 2);
          }
  
          $box.css({top: offset.top, left: offset.left, visibility:'visible'});
          
          // this gives the wrapper plenty of breathing room so it's floated contents can move around smoothly,
          // but it has to be shrank down around the size of div#colorbox when it's done.  If not,
          // it can invoke an obscure IE bug when using iframes.
          $wrap[0].style.width = $wrap[0].style.height = "9999px";
          
          function modalDimensions() {
              $topBorder[0].style.width = $bottomBorder[0].style.width = $content[0].style.width = (parseInt($box[0].style.width,10) - interfaceWidth)+'px';
              $content[0].style.height = $leftBorder[0].style.height = $rightBorder[0].style.height = (parseInt($box[0].style.height,10) - interfaceHeight)+'px';
          }
  
          css = {width: settings.w + loadedWidth + interfaceWidth, height: settings.h + loadedHeight + interfaceHeight, top: top, left: left};
  
          // setting the speed to 0 if the content hasn't changed size or position
          if (speed) {
              var tempSpeed = 0;
              $.each(css, function(i){
                  if (css[i] !== previousCSS[i]) {
                      tempSpeed = speed;
                      return;
                  }
              });
              speed = tempSpeed;
          }
  
          previousCSS = css;
  
          if (!speed) {
              $box.css(css);
          }
  
          $box.dequeue().animate(css, {
              duration: speed || 0,
              complete: function () {
                  modalDimensions();
                  
                  active = false;
                  
                  // shrink the wrapper down to exactly the size of colorbox to avoid a bug in IE's iframe implementation.
                  $wrap[0].style.width = (settings.w + loadedWidth + interfaceWidth) + "px";
                  $wrap[0].style.height = (settings.h + loadedHeight + interfaceHeight) + "px";
                  
                  if (settings.get('reposition')) {
                      setTimeout(function () {  // small delay before binding onresize due to an IE8 bug.
                          $window.bind('resize.' + prefix, publicMethod.position);
                      }, 1);
                  }
  
                  if ($.isFunction(loadedCallback)) {
                      loadedCallback();
                  }
              },
              step: modalDimensions
          });
      };
  
      publicMethod.resize = function (options) {
          var scrolltop;
          
          if (open) {
              options = options || {};
              
              if (options.width) {
                  settings.w = setSize(options.width, 'x') - loadedWidth - interfaceWidth;
              }
  
              if (options.innerWidth) {
                  settings.w = setSize(options.innerWidth, 'x');
              }
  
              $loaded.css({width: settings.w});
              
              if (options.height) {
                  settings.h = setSize(options.height, 'y') - loadedHeight - interfaceHeight;
              }
  
              if (options.innerHeight) {
                  settings.h = setSize(options.innerHeight, 'y');
              }
  
              if (!options.innerHeight && !options.height) {
                  scrolltop = $loaded.scrollTop();
                  $loaded.css({height: "auto"});
                  settings.h = $loaded.height();
              }
  
              $loaded.css({height: settings.h});
  
              if(scrolltop) {
                  $loaded.scrollTop(scrolltop);
              }
              
              publicMethod.position(settings.get('transition') === "none" ? 0 : settings.get('speed'));
          }
      };
  
      publicMethod.prep = function (object) {
          if (!open) {
              return;
          }
          
          var callback, speed = settings.get('transition') === "none" ? 0 : settings.get('speed');
  
          $loaded.remove();
  
          $loaded = $tag(div, 'LoadedContent').append(object);
          
          function getWidth() {
              settings.w = settings.w || $loaded.width();
              settings.w = settings.mw && settings.mw < settings.w ? settings.mw : settings.w;
              return settings.w;
          }
          function getHeight() {
              settings.h = settings.h || $loaded.height();
              settings.h = settings.mh && settings.mh < settings.h ? settings.mh : settings.h;
              return settings.h;
          }
          
          $loaded.hide()
          .appendTo($loadingBay.show())// content has to be appended to the DOM for accurate size calculations.
          .css({width: getWidth(), overflow: settings.get('scrolling') ? 'auto' : 'hidden'})
          .css({height: getHeight()})// sets the height independently from the width in case the new width influences the value of height.
          .prependTo($content);
          
          $loadingBay.hide();
          
          // floating the IMG removes the bottom line-height and fixed a problem where IE miscalculates the width of the parent element as 100% of the document width.
          
          $(photo).css({'float': 'none'});
  
          setClass(settings.get('className'));
  
          callback = function () {
              var total = $related.length,
                  iframe,
                  complete;
              
              if (!open) {
                  return;
              }
              
              function removeFilter() { // Needed for IE8 in versions of jQuery prior to 1.7.2
                  if ($.support.opacity === false) {
                      $box[0].style.removeAttribute('filter');
                  }
              }
              
              complete = function () {
                  clearTimeout(loadingTimer);
                  $loadingOverlay.hide();
                  trigger(event_complete);
                  settings.get('onComplete');
              };
  
              
              $title.html(settings.get('title')).show();
              $loaded.show();
              
              if (total > 1) { // handle grouping
                  if (typeof settings.get('current') === "string") {
                      $current.html(settings.get('current').replace('{current}', index + 1).replace('{total}', total)).show();
                  }
                  
                  $next[(settings.get('loop') || index < total - 1) ? "show" : "hide"]().html(settings.get('next'));
                  $prev[(settings.get('loop') || index) ? "show" : "hide"]().html(settings.get('previous'));
                  
                  slideshow();
                  
                  // Preloads images within a rel group
                  if (settings.get('preloading')) {
                      $.each([getIndex(-1), getIndex(1)], function(){
                          var img,
                              i = $related[this],
                              settings = new Settings(i, $.data(i, colorbox)),
                              src = settings.get('href');
  
                          if (src && isImage(settings, src)) {
                              src = retinaUrl(settings, src);
                              img = document.createElement('img');
                              img.src = src;
                          }
                      });
                  }
              } else {
                  $groupControls.hide();
              }
              
              if (settings.get('iframe')) {
                  iframe = document.createElement('iframe');
                  
                  if ('frameBorder' in iframe) {
                      iframe.frameBorder = 0;
                  }
                  
                  if ('allowTransparency' in iframe) {
                      iframe.allowTransparency = "true";
                  }
  
                  if (!settings.get('scrolling')) {
                      iframe.scrolling = "no";
                  }
                  
                  $(iframe)
                      .attr({
                          src: settings.get('href'),
                          name: (new Date()).getTime(), // give the iframe a unique name to prevent caching
                          'class': prefix + 'Iframe',
                          allowFullScreen : true // allow HTML5 video to go fullscreen
                      })
                      .one('load', complete)
                      .appendTo($loaded);
                  
                  $events.one(event_purge, function () {
                      iframe.src = "//about:blank";
                  });
  
                  if (settings.get('fastIframe')) {
                      $(iframe).trigger('load');
                  }
              } else {
                  complete();
              }
              
              if (settings.get('transition') === 'fade') {
                  $box.fadeTo(speed, 1, removeFilter);
              } else {
                  removeFilter();
              }
          };
          
          if (settings.get('transition') === 'fade') {
              $box.fadeTo(speed, 0, function () {
                  publicMethod.position(0, callback);
              });
          } else {
              publicMethod.position(speed, callback);
          }
      };
  
      function load () {
          var href, setResize, prep = publicMethod.prep, $inline, request = ++requests;
          
          active = true;
          
          photo = false;
          
          trigger(event_purge);
          trigger(event_load);
          settings.get('onLoad');
          
          settings.h = settings.get('height') ?
                  setSize(settings.get('height'), 'y') - loadedHeight - interfaceHeight :
                  settings.get('innerHeight') && setSize(settings.get('innerHeight'), 'y');
          
          settings.w = settings.get('width') ?
                  setSize(settings.get('width'), 'x') - loadedWidth - interfaceWidth :
                  settings.get('innerWidth') && setSize(settings.get('innerWidth'), 'x');
          
          // Sets the minimum dimensions for use in image scaling
          settings.mw = settings.w;
          settings.mh = settings.h;
          
          // Re-evaluate the minimum width and height based on maxWidth and maxHeight values.
          // If the width or height exceed the maxWidth or maxHeight, use the maximum values instead.
          if (settings.get('maxWidth')) {
              settings.mw = setSize(settings.get('maxWidth'), 'x') - loadedWidth - interfaceWidth;
              settings.mw = settings.w && settings.w < settings.mw ? settings.w : settings.mw;
          }
          if (settings.get('maxHeight')) {
              settings.mh = setSize(settings.get('maxHeight'), 'y') - loadedHeight - interfaceHeight;
              settings.mh = settings.h && settings.h < settings.mh ? settings.h : settings.mh;
          }
          
          href = settings.get('href');
          
          loadingTimer = setTimeout(function () {
              $loadingOverlay.show();
          }, 100);
          
          if (settings.get('inline')) {
              var $target = $(href);
              // Inserts an empty placeholder where inline content is being pulled from.
              // An event is bound to put inline content back when Colorbox closes or loads new content.
              $inline = $('<div>').hide().insertBefore($target);
  
              $events.one(event_purge, function () {
                  $inline.replaceWith($target);
              });
  
              prep($target);
          } else if (settings.get('iframe')) {
              // IFrame element won't be added to the DOM until it is ready to be displayed,
              // to avoid problems with DOM-ready JS that might be trying to run in that iframe.
              prep(" ");
          } else if (settings.get('html')) {
              prep(settings.get('html'));
          } else if (isImage(settings, href)) {
  
              href = retinaUrl(settings, href);
  
              photo = new Image();
  
              $(photo)
              .addClass(prefix + 'Photo')
              .bind('error',function () {
                  prep($tag(div, 'Error').html(settings.get('imgError')));
              })
              .one('load', function () {
                  if (request !== requests) {
                      return;
                  }
  
                  // A small pause because some browsers will occassionaly report a 
                  // img.width and img.height of zero immediately after the img.onload fires
                  setTimeout(function(){
                      var percent;
  
                      $.each(['alt', 'longdesc', 'aria-describedby'], function(i,val){
                          var attr = $(settings.el).attr(val) || $(settings.el).attr('data-'+val);
                          if (attr) {
                              photo.setAttribute(val, attr);
                          }
                      });
  
                      if (settings.get('retinaImage') && window.devicePixelRatio > 1) {
                          photo.height = photo.height / window.devicePixelRatio;
                          photo.width = photo.width / window.devicePixelRatio;
                      }
  
                      if (settings.get('scalePhotos')) {
                          setResize = function () {
                              photo.height -= photo.height * percent;
                              photo.width -= photo.width * percent;
                          };
                          if (settings.mw && photo.width > settings.mw) {
                              percent = (photo.width - settings.mw) / photo.width;
                              setResize();
                          }
                          if (settings.mh && photo.height > settings.mh) {
                              percent = (photo.height - settings.mh) / photo.height;
                              setResize();
                          }
                      }
                      
                      if (settings.h) {
                          photo.style.marginTop = Math.max(settings.mh - photo.height, 0) / 2 + 'px';
                      }
                      
                      if ($related[1] && (settings.get('loop') || $related[index + 1])) {
                          photo.style.cursor = 'pointer';
                          photo.onclick = function () {
                              publicMethod.next();
                          };
                      }
  
                      photo.style.width = photo.width + 'px';
                      photo.style.height = photo.height + 'px';
                      prep(photo);
                  }, 1);
              });
              
              photo.src = href;
  
          } else if (href) {
              $loadingBay.load(href, settings.get('data'), function (data, status) {
                  if (request === requests) {
                      prep(status === 'error' ? $tag(div, 'Error').html(settings.get('xhrError')) : $(this).contents());
                  }
              });
          }
      }
          
      // Navigates to the next page/image in a set.
      publicMethod.next = function () {
          if (!active && $related[1] && (settings.get('loop') || $related[index + 1])) {
              index = getIndex(1);
              launch($related[index]);
          }
      };
      
      publicMethod.prev = function () {
          if (!active && $related[1] && (settings.get('loop') || index)) {
              index = getIndex(-1);
              launch($related[index]);
          }
      };
  
      // Note: to use this within an iframe use the following format: parent.jQuery.colorbox.close();
      publicMethod.close = function () {
          if (open && !closing) {
              
              closing = true;
              open = false;
              trigger(event_cleanup);
              settings.get('onCleanup');
              $window.unbind('.' + prefix);
              $overlay.fadeTo(settings.get('fadeOut') || 0, 0);
              
              $box.stop().fadeTo(settings.get('fadeOut') || 0, 0, function () {
                  $box.hide();
                  $overlay.hide();
                  trigger(event_purge);
                  $loaded.remove();
                  
                  setTimeout(function () {
                      closing = false;
                      trigger(event_closed);
                      settings.get('onClosed');
                  }, 1);
              });
          }
      };
  
      // Removes changes Colorbox made to the document, but does not remove the plugin.
      publicMethod.remove = function () {
          if (!$box) { return; }
  
          $box.stop();
          $[colorbox].close();
          $box.stop(false, true).remove();
          $overlay.remove();
          closing = false;
          $box = null;
          $('.' + boxElement)
              .removeData(colorbox)
              .removeClass(boxElement);
  
          $(document).unbind('click.'+prefix).unbind('keydown.'+prefix);
      };
  
      // A method for fetching the current element Colorbox is referencing.
      // returns a jQuery object.
      publicMethod.element = function () {
          return $(settings.el);
      };
  
      publicMethod.settings = defaults;
  
  }(jQuery, document, window));
  ;
  !function(i){"use strict";"function"==typeof define&&define.amd?define(["jquery"],i):"undefined"!=typeof exports?module.exports=i(require("jquery")):i(jQuery)}(function(i){"use strict";var e=window.Slick||{};(e=function(){var e=0;return function(t,o){var s,n=this;n.defaults={accessibility:!0,adaptiveHeight:!1,appendArrows:i(t),appendDots:i(t),arrows:!0,asNavFor:null,prevArrow:'<button class="slick-prev" aria-label="Previous" type="button">Previous</button>',nextArrow:'<button class="slick-next" aria-label="Next" type="button">Next</button>',autoplay:!1,autoplaySpeed:3e3,centerMode:!1,centerPadding:"50px",cssEase:"ease",customPaging:function(e,t){return i('<button type="button" />').text(t+1)},dots:!1,dotsClass:"slick-dots",draggable:!0,easing:"linear",edgeFriction:.35,fade:!1,focusOnSelect:!1,focusOnChange:!1,infinite:!0,initialSlide:0,lazyLoad:"ondemand",mobileFirst:!1,pauseOnHover:!0,pauseOnFocus:!0,pauseOnDotsHover:!1,respondTo:"window",responsive:null,rows:1,rtl:!1,slide:"",slidesPerRow:1,slidesToShow:1,slidesToScroll:1,speed:500,swipe:!0,swipeToSlide:!1,touchMove:!0,touchThreshold:5,useCSS:!0,useTransform:!0,variableWidth:!1,vertical:!1,verticalSwiping:!1,waitForAnimate:!0,zIndex:1e3},n.initials={animating:!1,dragging:!1,autoPlayTimer:null,currentDirection:0,currentLeft:null,currentSlide:0,direction:1,$dots:null,listWidth:null,listHeight:null,loadIndex:0,$nextArrow:null,$prevArrow:null,scrolling:!1,slideCount:null,slideWidth:null,$slideTrack:null,$slides:null,sliding:!1,slideOffset:0,swipeLeft:null,swiping:!1,$list:null,touchObject:{},transformsEnabled:!1,unslicked:!1},i.extend(n,n.initials),n.activeBreakpoint=null,n.animType=null,n.animProp=null,n.breakpoints=[],n.breakpointSettings=[],n.cssTransitions=!1,n.focussed=!1,n.interrupted=!1,n.hidden="hidden",n.paused=!0,n.positionProp=null,n.respondTo=null,n.rowCount=1,n.shouldClick=!0,n.$slider=i(t),n.$slidesCache=null,n.transformType=null,n.transitionType=null,n.visibilityChange="visibilitychange",n.windowWidth=0,n.windowTimer=null,s=i(t).data("slick")||{},n.options=i.extend({},n.defaults,o,s),n.currentSlide=n.options.initialSlide,n.originalSettings=n.options,void 0!==document.mozHidden?(n.hidden="mozHidden",n.visibilityChange="mozvisibilitychange"):void 0!==document.webkitHidden&&(n.hidden="webkitHidden",n.visibilityChange="webkitvisibilitychange"),n.autoPlay=i.proxy(n.autoPlay,n),n.autoPlayClear=i.proxy(n.autoPlayClear,n),n.autoPlayIterator=i.proxy(n.autoPlayIterator,n),n.changeSlide=i.proxy(n.changeSlide,n),n.clickHandler=i.proxy(n.clickHandler,n),n.selectHandler=i.proxy(n.selectHandler,n),n.setPosition=i.proxy(n.setPosition,n),n.swipeHandler=i.proxy(n.swipeHandler,n),n.dragHandler=i.proxy(n.dragHandler,n),n.keyHandler=i.proxy(n.keyHandler,n),n.instanceUid=e++,n.htmlExpr=/^(?:\s*(<[\w\W]+>)[^>]*)$/,n.registerBreakpoints(),n.init(!0)}}()).prototype.activateADA=function(){this.$slideTrack.find(".slick-active").attr({"aria-hidden":"false"}).find("a, input, button, select").attr({tabindex:"0"})},e.prototype.addSlide=e.prototype.slickAdd=function(e,t,o){var s=this;if("boolean"==typeof t)o=t,t=null;else if(t<0||t>=s.slideCount)return!1;s.unload(),"number"==typeof t?0===t&&0===s.$slides.length?i(e).appendTo(s.$slideTrack):o?i(e).insertBefore(s.$slides.eq(t)):i(e).insertAfter(s.$slides.eq(t)):!0===o?i(e).prependTo(s.$slideTrack):i(e).appendTo(s.$slideTrack),s.$slides=s.$slideTrack.children(this.options.slide),s.$slideTrack.children(this.options.slide).detach(),s.$slideTrack.append(s.$slides),s.$slides.each(function(e,t){i(t).attr("data-slick-index",e)}),s.$slidesCache=s.$slides,s.reinit()},e.prototype.animateHeight=function(){var i=this;if(1===i.options.slidesToShow&&!0===i.options.adaptiveHeight&&!1===i.options.vertical){var e=i.$slides.eq(i.currentSlide).outerHeight(!0);i.$list.animate({height:e},i.options.speed)}},e.prototype.animateSlide=function(e,t){var o={},s=this;s.animateHeight(),!0===s.options.rtl&&!1===s.options.vertical&&(e=-e),!1===s.transformsEnabled?!1===s.options.vertical?s.$slideTrack.animate({left:e},s.options.speed,s.options.easing,t):s.$slideTrack.animate({top:e},s.options.speed,s.options.easing,t):!1===s.cssTransitions?(!0===s.options.rtl&&(s.currentLeft=-s.currentLeft),i({animStart:s.currentLeft}).animate({animStart:e},{duration:s.options.speed,easing:s.options.easing,step:function(i){i=Math.ceil(i),!1===s.options.vertical?(o[s.animType]="translate("+i+"px, 0px)",s.$slideTrack.css(o)):(o[s.animType]="translate(0px,"+i+"px)",s.$slideTrack.css(o))},complete:function(){t&&t.call()}})):(s.applyTransition(),e=Math.ceil(e),!1===s.options.vertical?o[s.animType]="translate3d("+e+"px, 0px, 0px)":o[s.animType]="translate3d(0px,"+e+"px, 0px)",s.$slideTrack.css(o),t&&setTimeout(function(){s.disableTransition(),t.call()},s.options.speed))},e.prototype.getNavTarget=function(){var e=this,t=e.options.asNavFor;return t&&null!==t&&(t=i(t).not(e.$slider)),t},e.prototype.asNavFor=function(e){var t=this.getNavTarget();null!==t&&"object"==typeof t&&t.each(function(){var t=i(this).slick("getSlick");t.unslicked||t.slideHandler(e,!0)})},e.prototype.applyTransition=function(i){var e=this,t={};!1===e.options.fade?t[e.transitionType]=e.transformType+" "+e.options.speed+"ms "+e.options.cssEase:t[e.transitionType]="opacity "+e.options.speed+"ms "+e.options.cssEase,!1===e.options.fade?e.$slideTrack.css(t):e.$slides.eq(i).css(t)},e.prototype.autoPlay=function(){var i=this;i.autoPlayClear(),i.slideCount>i.options.slidesToShow&&(i.autoPlayTimer=setInterval(i.autoPlayIterator,i.options.autoplaySpeed))},e.prototype.autoPlayClear=function(){var i=this;i.autoPlayTimer&&clearInterval(i.autoPlayTimer)},e.prototype.autoPlayIterator=function(){var i=this,e=i.currentSlide+i.options.slidesToScroll;i.paused||i.interrupted||i.focussed||(!1===i.options.infinite&&(1===i.direction&&i.currentSlide+1===i.slideCount-1?i.direction=0:0===i.direction&&(e=i.currentSlide-i.options.slidesToScroll,i.currentSlide-1==0&&(i.direction=1))),i.slideHandler(e))},e.prototype.buildArrows=function(){var e=this;!0===e.options.arrows&&(e.$prevArrow=i(e.options.prevArrow).addClass("slick-arrow"),e.$nextArrow=i(e.options.nextArrow).addClass("slick-arrow"),e.slideCount>e.options.slidesToShow?(e.$prevArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),e.$nextArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),e.htmlExpr.test(e.options.prevArrow)&&e.$prevArrow.prependTo(e.options.appendArrows),e.htmlExpr.test(e.options.nextArrow)&&e.$nextArrow.appendTo(e.options.appendArrows),!0!==e.options.infinite&&e.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true")):e.$prevArrow.add(e.$nextArrow).addClass("slick-hidden").attr({"aria-disabled":"true",tabindex:"-1"}))},e.prototype.buildDots=function(){var e,t,o=this;if(!0===o.options.dots){for(o.$slider.addClass("slick-dotted"),t=i("<ul />").addClass(o.options.dotsClass),e=0;e<=o.getDotCount();e+=1)t.append(i("<li />").append(o.options.customPaging.call(this,o,e)));o.$dots=t.appendTo(o.options.appendDots),o.$dots.find("li").first().addClass("slick-active")}},e.prototype.buildOut=function(){var e=this;e.$slides=e.$slider.children(e.options.slide+":not(.slick-cloned)").addClass("slick-slide"),e.slideCount=e.$slides.length,e.$slides.each(function(e,t){i(t).attr("data-slick-index",e).data("originalStyling",i(t).attr("style")||"")}),e.$slider.addClass("slick-slider"),e.$slideTrack=0===e.slideCount?i('<div class="slick-track"/>').appendTo(e.$slider):e.$slides.wrapAll('<div class="slick-track"/>').parent(),e.$list=e.$slideTrack.wrap('<div class="slick-list"/>').parent(),e.$slideTrack.css("opacity",0),!0!==e.options.centerMode&&!0!==e.options.swipeToSlide||(e.options.slidesToScroll=1),i("img[data-lazy]",e.$slider).not("[src]").addClass("slick-loading"),e.setupInfinite(),e.buildArrows(),e.buildDots(),e.updateDots(),e.setSlideClasses("number"==typeof e.currentSlide?e.currentSlide:0),!0===e.options.draggable&&e.$list.addClass("draggable")},e.prototype.buildRows=function(){var i,e,t,o,s,n,r,l=this;if(o=document.createDocumentFragment(),n=l.$slider.children(),l.options.rows>1){for(r=l.options.slidesPerRow*l.options.rows,s=Math.ceil(n.length/r),i=0;i<s;i++){var d=document.createElement("div");for(e=0;e<l.options.rows;e++){var a=document.createElement("div");for(t=0;t<l.options.slidesPerRow;t++){var c=i*r+(e*l.options.slidesPerRow+t);n.get(c)&&a.appendChild(n.get(c))}d.appendChild(a)}o.appendChild(d)}l.$slider.empty().append(o),l.$slider.children().children().children().css({width:100/l.options.slidesPerRow+"%",display:"inline-block"})}},e.prototype.checkResponsive=function(e,t){var o,s,n,r=this,l=!1,d=r.$slider.width(),a=window.innerWidth||i(window).width();if("window"===r.respondTo?n=a:"slider"===r.respondTo?n=d:"min"===r.respondTo&&(n=Math.min(a,d)),r.options.responsive&&r.options.responsive.length&&null!==r.options.responsive){s=null;for(o in r.breakpoints)r.breakpoints.hasOwnProperty(o)&&(!1===r.originalSettings.mobileFirst?n<r.breakpoints[o]&&(s=r.breakpoints[o]):n>r.breakpoints[o]&&(s=r.breakpoints[o]));null!==s?null!==r.activeBreakpoint?(s!==r.activeBreakpoint||t)&&(r.activeBreakpoint=s,"unslick"===r.breakpointSettings[s]?r.unslick(s):(r.options=i.extend({},r.originalSettings,r.breakpointSettings[s]),!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e)),l=s):(r.activeBreakpoint=s,"unslick"===r.breakpointSettings[s]?r.unslick(s):(r.options=i.extend({},r.originalSettings,r.breakpointSettings[s]),!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e)),l=s):null!==r.activeBreakpoint&&(r.activeBreakpoint=null,r.options=r.originalSettings,!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e),l=s),e||!1===l||r.$slider.trigger("breakpoint",[r,l])}},e.prototype.changeSlide=function(e,t){var o,s,n,r=this,l=i(e.currentTarget);switch(l.is("a")&&e.preventDefault(),l.is("li")||(l=l.closest("li")),n=r.slideCount%r.options.slidesToScroll!=0,o=n?0:(r.slideCount-r.currentSlide)%r.options.slidesToScroll,e.data.message){case"previous":s=0===o?r.options.slidesToScroll:r.options.slidesToShow-o,r.slideCount>r.options.slidesToShow&&r.slideHandler(r.currentSlide-s,!1,t);break;case"next":s=0===o?r.options.slidesToScroll:o,r.slideCount>r.options.slidesToShow&&r.slideHandler(r.currentSlide+s,!1,t);break;case"index":var d=0===e.data.index?0:e.data.index||l.index()*r.options.slidesToScroll;r.slideHandler(r.checkNavigable(d),!1,t),l.children().trigger("focus");break;default:return}},e.prototype.checkNavigable=function(i){var e,t;if(e=this.getNavigableIndexes(),t=0,i>e[e.length-1])i=e[e.length-1];else for(var o in e){if(i<e[o]){i=t;break}t=e[o]}return i},e.prototype.cleanUpEvents=function(){var e=this;e.options.dots&&null!==e.$dots&&(i("li",e.$dots).off("click.slick",e.changeSlide).off("mouseenter.slick",i.proxy(e.interrupt,e,!0)).off("mouseleave.slick",i.proxy(e.interrupt,e,!1)),!0===e.options.accessibility&&e.$dots.off("keydown.slick",e.keyHandler)),e.$slider.off("focus.slick blur.slick"),!0===e.options.arrows&&e.slideCount>e.options.slidesToShow&&(e.$prevArrow&&e.$prevArrow.off("click.slick",e.changeSlide),e.$nextArrow&&e.$nextArrow.off("click.slick",e.changeSlide),!0===e.options.accessibility&&(e.$prevArrow&&e.$prevArrow.off("keydown.slick",e.keyHandler),e.$nextArrow&&e.$nextArrow.off("keydown.slick",e.keyHandler))),e.$list.off("touchstart.slick mousedown.slick",e.swipeHandler),e.$list.off("touchmove.slick mousemove.slick",e.swipeHandler),e.$list.off("touchend.slick mouseup.slick",e.swipeHandler),e.$list.off("touchcancel.slick mouseleave.slick",e.swipeHandler),e.$list.off("click.slick",e.clickHandler),i(document).off(e.visibilityChange,e.visibility),e.cleanUpSlideEvents(),!0===e.options.accessibility&&e.$list.off("keydown.slick",e.keyHandler),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().off("click.slick",e.selectHandler),i(window).off("orientationchange.slick.slick-"+e.instanceUid,e.orientationChange),i(window).off("resize.slick.slick-"+e.instanceUid,e.resize),i("[draggable!=true]",e.$slideTrack).off("dragstart",e.preventDefault),i(window).off("load.slick.slick-"+e.instanceUid,e.setPosition)},e.prototype.cleanUpSlideEvents=function(){var e=this;e.$list.off("mouseenter.slick",i.proxy(e.interrupt,e,!0)),e.$list.off("mouseleave.slick",i.proxy(e.interrupt,e,!1))},e.prototype.cleanUpRows=function(){var i,e=this;e.options.rows>1&&((i=e.$slides.children().children()).removeAttr("style"),e.$slider.empty().append(i))},e.prototype.clickHandler=function(i){!1===this.shouldClick&&(i.stopImmediatePropagation(),i.stopPropagation(),i.preventDefault())},e.prototype.destroy=function(e){var t=this;t.autoPlayClear(),t.touchObject={},t.cleanUpEvents(),i(".slick-cloned",t.$slider).detach(),t.$dots&&t.$dots.remove(),t.$prevArrow&&t.$prevArrow.length&&(t.$prevArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),t.htmlExpr.test(t.options.prevArrow)&&t.$prevArrow.remove()),t.$nextArrow&&t.$nextArrow.length&&(t.$nextArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),t.htmlExpr.test(t.options.nextArrow)&&t.$nextArrow.remove()),t.$slides&&(t.$slides.removeClass("slick-slide slick-active slick-center slick-visible slick-current").removeAttr("aria-hidden").removeAttr("data-slick-index").each(function(){i(this).attr("style",i(this).data("originalStyling"))}),t.$slideTrack.children(this.options.slide).detach(),t.$slideTrack.detach(),t.$list.detach(),t.$slider.append(t.$slides)),t.cleanUpRows(),t.$slider.removeClass("slick-slider"),t.$slider.removeClass("slick-initialized"),t.$slider.removeClass("slick-dotted"),t.unslicked=!0,e||t.$slider.trigger("destroy",[t])},e.prototype.disableTransition=function(i){var e=this,t={};t[e.transitionType]="",!1===e.options.fade?e.$slideTrack.css(t):e.$slides.eq(i).css(t)},e.prototype.fadeSlide=function(i,e){var t=this;!1===t.cssTransitions?(t.$slides.eq(i).css({zIndex:t.options.zIndex}),t.$slides.eq(i).animate({opacity:1},t.options.speed,t.options.easing,e)):(t.applyTransition(i),t.$slides.eq(i).css({opacity:1,zIndex:t.options.zIndex}),e&&setTimeout(function(){t.disableTransition(i),e.call()},t.options.speed))},e.prototype.fadeSlideOut=function(i){var e=this;!1===e.cssTransitions?e.$slides.eq(i).animate({opacity:0,zIndex:e.options.zIndex-2},e.options.speed,e.options.easing):(e.applyTransition(i),e.$slides.eq(i).css({opacity:0,zIndex:e.options.zIndex-2}))},e.prototype.filterSlides=e.prototype.slickFilter=function(i){var e=this;null!==i&&(e.$slidesCache=e.$slides,e.unload(),e.$slideTrack.children(this.options.slide).detach(),e.$slidesCache.filter(i).appendTo(e.$slideTrack),e.reinit())},e.prototype.focusHandler=function(){var e=this;e.$slider.off("focus.slick blur.slick").on("focus.slick blur.slick","*",function(t){t.stopImmediatePropagation();var o=i(this);setTimeout(function(){e.options.pauseOnFocus&&(e.focussed=o.is(":focus"),e.autoPlay())},0)})},e.prototype.getCurrent=e.prototype.slickCurrentSlide=function(){return this.currentSlide},e.prototype.getDotCount=function(){var i=this,e=0,t=0,o=0;if(!0===i.options.infinite)if(i.slideCount<=i.options.slidesToShow)++o;else for(;e<i.slideCount;)++o,e=t+i.options.slidesToScroll,t+=i.options.slidesToScroll<=i.options.slidesToShow?i.options.slidesToScroll:i.options.slidesToShow;else if(!0===i.options.centerMode)o=i.slideCount;else if(i.options.asNavFor)for(;e<i.slideCount;)++o,e=t+i.options.slidesToScroll,t+=i.options.slidesToScroll<=i.options.slidesToShow?i.options.slidesToScroll:i.options.slidesToShow;else o=1+Math.ceil((i.slideCount-i.options.slidesToShow)/i.options.slidesToScroll);return o-1},e.prototype.getLeft=function(i){var e,t,o,s,n=this,r=0;return n.slideOffset=0,t=n.$slides.first().outerHeight(!0),!0===n.options.infinite?(n.slideCount>n.options.slidesToShow&&(n.slideOffset=n.slideWidth*n.options.slidesToShow*-1,s=-1,!0===n.options.vertical&&!0===n.options.centerMode&&(2===n.options.slidesToShow?s=-1.5:1===n.options.slidesToShow&&(s=-2)),r=t*n.options.slidesToShow*s),n.slideCount%n.options.slidesToScroll!=0&&i+n.options.slidesToScroll>n.slideCount&&n.slideCount>n.options.slidesToShow&&(i>n.slideCount?(n.slideOffset=(n.options.slidesToShow-(i-n.slideCount))*n.slideWidth*-1,r=(n.options.slidesToShow-(i-n.slideCount))*t*-1):(n.slideOffset=n.slideCount%n.options.slidesToScroll*n.slideWidth*-1,r=n.slideCount%n.options.slidesToScroll*t*-1))):i+n.options.slidesToShow>n.slideCount&&(n.slideOffset=(i+n.options.slidesToShow-n.slideCount)*n.slideWidth,r=(i+n.options.slidesToShow-n.slideCount)*t),n.slideCount<=n.options.slidesToShow&&(n.slideOffset=0,r=0),!0===n.options.centerMode&&n.slideCount<=n.options.slidesToShow?n.slideOffset=n.slideWidth*Math.floor(n.options.slidesToShow)/2-n.slideWidth*n.slideCount/2:!0===n.options.centerMode&&!0===n.options.infinite?n.slideOffset+=n.slideWidth*Math.floor(n.options.slidesToShow/2)-n.slideWidth:!0===n.options.centerMode&&(n.slideOffset=0,n.slideOffset+=n.slideWidth*Math.floor(n.options.slidesToShow/2)),e=!1===n.options.vertical?i*n.slideWidth*-1+n.slideOffset:i*t*-1+r,!0===n.options.variableWidth&&(o=n.slideCount<=n.options.slidesToShow||!1===n.options.infinite?n.$slideTrack.children(".slick-slide").eq(i):n.$slideTrack.children(".slick-slide").eq(i+n.options.slidesToShow),e=!0===n.options.rtl?o[0]?-1*(n.$slideTrack.width()-o[0].offsetLeft-o.width()):0:o[0]?-1*o[0].offsetLeft:0,!0===n.options.centerMode&&(o=n.slideCount<=n.options.slidesToShow||!1===n.options.infinite?n.$slideTrack.children(".slick-slide").eq(i):n.$slideTrack.children(".slick-slide").eq(i+n.options.slidesToShow+1),e=!0===n.options.rtl?o[0]?-1*(n.$slideTrack.width()-o[0].offsetLeft-o.width()):0:o[0]?-1*o[0].offsetLeft:0,e+=(n.$list.width()-o.outerWidth())/2)),e},e.prototype.getOption=e.prototype.slickGetOption=function(i){return this.options[i]},e.prototype.getNavigableIndexes=function(){var i,e=this,t=0,o=0,s=[];for(!1===e.options.infinite?i=e.slideCount:(t=-1*e.options.slidesToScroll,o=-1*e.options.slidesToScroll,i=2*e.slideCount);t<i;)s.push(t),t=o+e.options.slidesToScroll,o+=e.options.slidesToScroll<=e.options.slidesToShow?e.options.slidesToScroll:e.options.slidesToShow;return s},e.prototype.getSlick=function(){return this},e.prototype.getSlideCount=function(){var e,t,o=this;return t=!0===o.options.centerMode?o.slideWidth*Math.floor(o.options.slidesToShow/2):0,!0===o.options.swipeToSlide?(o.$slideTrack.find(".slick-slide").each(function(s,n){if(n.offsetLeft-t+i(n).outerWidth()/2>-1*o.swipeLeft)return e=n,!1}),Math.abs(i(e).attr("data-slick-index")-o.currentSlide)||1):o.options.slidesToScroll},e.prototype.goTo=e.prototype.slickGoTo=function(i,e){this.changeSlide({data:{message:"index",index:parseInt(i)}},e)},e.prototype.init=function(e){var t=this;i(t.$slider).hasClass("slick-initialized")||(i(t.$slider).addClass("slick-initialized"),t.buildRows(),t.buildOut(),t.setProps(),t.startLoad(),t.loadSlider(),t.initializeEvents(),t.updateArrows(),t.updateDots(),t.checkResponsive(!0),t.focusHandler()),e&&t.$slider.trigger("init",[t]),!0===t.options.accessibility&&t.initADA(),t.options.autoplay&&(t.paused=!1,t.autoPlay())},e.prototype.initADA=function(){var e=this,t=Math.ceil(e.slideCount/e.options.slidesToShow),o=e.getNavigableIndexes().filter(function(i){return i>=0&&i<e.slideCount});e.$slides.add(e.$slideTrack.find(".slick-cloned")).attr({"aria-hidden":"true",tabindex:"-1"}).find("a, input, button, select").attr({tabindex:"-1"}),null!==e.$dots&&(e.$slides.not(e.$slideTrack.find(".slick-cloned")).each(function(t){var s=o.indexOf(t);i(this).attr({role:"tabpanel",id:"slick-slide"+e.instanceUid+t,tabindex:-1}),-1!==s&&i(this).attr({"aria-describedby":"slick-slide-control"+e.instanceUid+s})}),e.$dots.attr("role","tablist").find("li").each(function(s){var n=o[s];i(this).attr({role:"presentation"}),i(this).find("button").first().attr({role:"tab",id:"slick-slide-control"+e.instanceUid+s,"aria-controls":"slick-slide"+e.instanceUid+n,"aria-label":s+1+" of "+t,"aria-selected":null,tabindex:"-1"})}).eq(e.currentSlide).find("button").attr({"aria-selected":"true",tabindex:"0"}).end());for(var s=e.currentSlide,n=s+e.options.slidesToShow;s<n;s++)e.$slides.eq(s).attr("tabindex",0);e.activateADA()},e.prototype.initArrowEvents=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.off("click.slick").on("click.slick",{message:"previous"},i.changeSlide),i.$nextArrow.off("click.slick").on("click.slick",{message:"next"},i.changeSlide),!0===i.options.accessibility&&(i.$prevArrow.on("keydown.slick",i.keyHandler),i.$nextArrow.on("keydown.slick",i.keyHandler)))},e.prototype.initDotEvents=function(){var e=this;!0===e.options.dots&&(i("li",e.$dots).on("click.slick",{message:"index"},e.changeSlide),!0===e.options.accessibility&&e.$dots.on("keydown.slick",e.keyHandler)),!0===e.options.dots&&!0===e.options.pauseOnDotsHover&&i("li",e.$dots).on("mouseenter.slick",i.proxy(e.interrupt,e,!0)).on("mouseleave.slick",i.proxy(e.interrupt,e,!1))},e.prototype.initSlideEvents=function(){var e=this;e.options.pauseOnHover&&(e.$list.on("mouseenter.slick",i.proxy(e.interrupt,e,!0)),e.$list.on("mouseleave.slick",i.proxy(e.interrupt,e,!1)))},e.prototype.initializeEvents=function(){var e=this;e.initArrowEvents(),e.initDotEvents(),e.initSlideEvents(),e.$list.on("touchstart.slick mousedown.slick",{action:"start"},e.swipeHandler),e.$list.on("touchmove.slick mousemove.slick",{action:"move"},e.swipeHandler),e.$list.on("touchend.slick mouseup.slick",{action:"end"},e.swipeHandler),e.$list.on("touchcancel.slick mouseleave.slick",{action:"end"},e.swipeHandler),e.$list.on("click.slick",e.clickHandler),i(document).on(e.visibilityChange,i.proxy(e.visibility,e)),!0===e.options.accessibility&&e.$list.on("keydown.slick",e.keyHandler),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().on("click.slick",e.selectHandler),i(window).on("orientationchange.slick.slick-"+e.instanceUid,i.proxy(e.orientationChange,e)),i(window).on("resize.slick.slick-"+e.instanceUid,i.proxy(e.resize,e)),i("[draggable!=true]",e.$slideTrack).on("dragstart",e.preventDefault),i(window).on("load.slick.slick-"+e.instanceUid,e.setPosition),i(e.setPosition)},e.prototype.initUI=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.show(),i.$nextArrow.show()),!0===i.options.dots&&i.slideCount>i.options.slidesToShow&&i.$dots.show()},e.prototype.keyHandler=function(i){var e=this;i.target.tagName.match("TEXTAREA|INPUT|SELECT")||(37===i.keyCode&&!0===e.options.accessibility?e.changeSlide({data:{message:!0===e.options.rtl?"next":"previous"}}):39===i.keyCode&&!0===e.options.accessibility&&e.changeSlide({data:{message:!0===e.options.rtl?"previous":"next"}}))},e.prototype.lazyLoad=function(){function e(e){i("img[data-lazy]",e).each(function(){var e=i(this),t=i(this).attr("data-lazy"),o=i(this).attr("data-srcset"),s=i(this).attr("data-sizes")||n.$slider.attr("data-sizes"),r=document.createElement("img");r.onload=function(){e.animate({opacity:0},100,function(){o&&(e.attr("srcset",o),s&&e.attr("sizes",s)),e.attr("src",t).animate({opacity:1},200,function(){e.removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading")}),n.$slider.trigger("lazyLoaded",[n,e,t])})},r.onerror=function(){e.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"),n.$slider.trigger("lazyLoadError",[n,e,t])},r.src=t})}var t,o,s,n=this;if(!0===n.options.centerMode?!0===n.options.infinite?s=(o=n.currentSlide+(n.options.slidesToShow/2+1))+n.options.slidesToShow+2:(o=Math.max(0,n.currentSlide-(n.options.slidesToShow/2+1)),s=n.options.slidesToShow/2+1+2+n.currentSlide):(o=n.options.infinite?n.options.slidesToShow+n.currentSlide:n.currentSlide,s=Math.ceil(o+n.options.slidesToShow),!0===n.options.fade&&(o>0&&o--,s<=n.slideCount&&s++)),t=n.$slider.find(".slick-slide").slice(o,s),"anticipated"===n.options.lazyLoad)for(var r=o-1,l=s,d=n.$slider.find(".slick-slide"),a=0;a<n.options.slidesToScroll;a++)r<0&&(r=n.slideCount-1),t=(t=t.add(d.eq(r))).add(d.eq(l)),r--,l++;e(t),n.slideCount<=n.options.slidesToShow?e(n.$slider.find(".slick-slide")):n.currentSlide>=n.slideCount-n.options.slidesToShow?e(n.$slider.find(".slick-cloned").slice(0,n.options.slidesToShow)):0===n.currentSlide&&e(n.$slider.find(".slick-cloned").slice(-1*n.options.slidesToShow))},e.prototype.loadSlider=function(){var i=this;i.setPosition(),i.$slideTrack.css({opacity:1}),i.$slider.removeClass("slick-loading"),i.initUI(),"progressive"===i.options.lazyLoad&&i.progressiveLazyLoad()},e.prototype.next=e.prototype.slickNext=function(){this.changeSlide({data:{message:"next"}})},e.prototype.orientationChange=function(){var i=this;i.checkResponsive(),i.setPosition()},e.prototype.pause=e.prototype.slickPause=function(){var i=this;i.autoPlayClear(),i.paused=!0},e.prototype.play=e.prototype.slickPlay=function(){var i=this;i.autoPlay(),i.options.autoplay=!0,i.paused=!1,i.focussed=!1,i.interrupted=!1},e.prototype.postSlide=function(e){var t=this;t.unslicked||(t.$slider.trigger("afterChange",[t,e]),t.animating=!1,t.slideCount>t.options.slidesToShow&&t.setPosition(),t.swipeLeft=null,t.options.autoplay&&t.autoPlay(),!0===t.options.accessibility&&(t.initADA(),t.options.focusOnChange&&i(t.$slides.get(t.currentSlide)).attr("tabindex",0).focus()))},e.prototype.prev=e.prototype.slickPrev=function(){this.changeSlide({data:{message:"previous"}})},e.prototype.preventDefault=function(i){i.preventDefault()},e.prototype.progressiveLazyLoad=function(e){e=e||1;var t,o,s,n,r,l=this,d=i("img[data-lazy]",l.$slider);d.length?(t=d.first(),o=t.attr("data-lazy"),s=t.attr("data-srcset"),n=t.attr("data-sizes")||l.$slider.attr("data-sizes"),(r=document.createElement("img")).onload=function(){s&&(t.attr("srcset",s),n&&t.attr("sizes",n)),t.attr("src",o).removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading"),!0===l.options.adaptiveHeight&&l.setPosition(),l.$slider.trigger("lazyLoaded",[l,t,o]),l.progressiveLazyLoad()},r.onerror=function(){e<3?setTimeout(function(){l.progressiveLazyLoad(e+1)},500):(t.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"),l.$slider.trigger("lazyLoadError",[l,t,o]),l.progressiveLazyLoad())},r.src=o):l.$slider.trigger("allImagesLoaded",[l])},e.prototype.refresh=function(e){var t,o,s=this;o=s.slideCount-s.options.slidesToShow,!s.options.infinite&&s.currentSlide>o&&(s.currentSlide=o),s.slideCount<=s.options.slidesToShow&&(s.currentSlide=0),t=s.currentSlide,s.destroy(!0),i.extend(s,s.initials,{currentSlide:t}),s.init(),e||s.changeSlide({data:{message:"index",index:t}},!1)},e.prototype.registerBreakpoints=function(){var e,t,o,s=this,n=s.options.responsive||null;if("array"===i.type(n)&&n.length){s.respondTo=s.options.respondTo||"window";for(e in n)if(o=s.breakpoints.length-1,n.hasOwnProperty(e)){for(t=n[e].breakpoint;o>=0;)s.breakpoints[o]&&s.breakpoints[o]===t&&s.breakpoints.splice(o,1),o--;s.breakpoints.push(t),s.breakpointSettings[t]=n[e].settings}s.breakpoints.sort(function(i,e){return s.options.mobileFirst?i-e:e-i})}},e.prototype.reinit=function(){var e=this;e.$slides=e.$slideTrack.children(e.options.slide).addClass("slick-slide"),e.slideCount=e.$slides.length,e.currentSlide>=e.slideCount&&0!==e.currentSlide&&(e.currentSlide=e.currentSlide-e.options.slidesToScroll),e.slideCount<=e.options.slidesToShow&&(e.currentSlide=0),e.registerBreakpoints(),e.setProps(),e.setupInfinite(),e.buildArrows(),e.updateArrows(),e.initArrowEvents(),e.buildDots(),e.updateDots(),e.initDotEvents(),e.cleanUpSlideEvents(),e.initSlideEvents(),e.checkResponsive(!1,!0),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().on("click.slick",e.selectHandler),e.setSlideClasses("number"==typeof e.currentSlide?e.currentSlide:0),e.setPosition(),e.focusHandler(),e.paused=!e.options.autoplay,e.autoPlay(),e.$slider.trigger("reInit",[e])},e.prototype.resize=function(){var e=this;i(window).width()!==e.windowWidth&&(clearTimeout(e.windowDelay),e.windowDelay=window.setTimeout(function(){e.windowWidth=i(window).width(),e.checkResponsive(),e.unslicked||e.setPosition()},50))},e.prototype.removeSlide=e.prototype.slickRemove=function(i,e,t){var o=this;if(i="boolean"==typeof i?!0===(e=i)?0:o.slideCount-1:!0===e?--i:i,o.slideCount<1||i<0||i>o.slideCount-1)return!1;o.unload(),!0===t?o.$slideTrack.children().remove():o.$slideTrack.children(this.options.slide).eq(i).remove(),o.$slides=o.$slideTrack.children(this.options.slide),o.$slideTrack.children(this.options.slide).detach(),o.$slideTrack.append(o.$slides),o.$slidesCache=o.$slides,o.reinit()},e.prototype.setCSS=function(i){var e,t,o=this,s={};!0===o.options.rtl&&(i=-i),e="left"==o.positionProp?Math.ceil(i)+"px":"0px",t="top"==o.positionProp?Math.ceil(i)+"px":"0px",s[o.positionProp]=i,!1===o.transformsEnabled?o.$slideTrack.css(s):(s={},!1===o.cssTransitions?(s[o.animType]="translate("+e+", "+t+")",o.$slideTrack.css(s)):(s[o.animType]="translate3d("+e+", "+t+", 0px)",o.$slideTrack.css(s)))},e.prototype.setDimensions=function(){var i=this;!1===i.options.vertical?!0===i.options.centerMode&&i.$list.css({padding:"0px "+i.options.centerPadding}):(i.$list.height(i.$slides.first().outerHeight(!0)*i.options.slidesToShow),!0===i.options.centerMode&&i.$list.css({padding:i.options.centerPadding+" 0px"})),i.listWidth=i.$list.width(),i.listHeight=i.$list.height(),!1===i.options.vertical&&!1===i.options.variableWidth?(i.slideWidth=Math.ceil(i.listWidth/i.options.slidesToShow),i.$slideTrack.width(Math.ceil(i.slideWidth*i.$slideTrack.children(".slick-slide").length))):!0===i.options.variableWidth?i.$slideTrack.width(5e3*i.slideCount):(i.slideWidth=Math.ceil(i.listWidth),i.$slideTrack.height(Math.ceil(i.$slides.first().outerHeight(!0)*i.$slideTrack.children(".slick-slide").length)));var e=i.$slides.first().outerWidth(!0)-i.$slides.first().width();!1===i.options.variableWidth&&i.$slideTrack.children(".slick-slide").width(i.slideWidth-e)},e.prototype.setFade=function(){var e,t=this;t.$slides.each(function(o,s){e=t.slideWidth*o*-1,!0===t.options.rtl?i(s).css({position:"relative",right:e,top:0,zIndex:t.options.zIndex-2,opacity:0}):i(s).css({position:"relative",left:e,top:0,zIndex:t.options.zIndex-2,opacity:0})}),t.$slides.eq(t.currentSlide).css({zIndex:t.options.zIndex-1,opacity:1})},e.prototype.setHeight=function(){var i=this;if(1===i.options.slidesToShow&&!0===i.options.adaptiveHeight&&!1===i.options.vertical){var e=i.$slides.eq(i.currentSlide).outerHeight(!0);i.$list.css("height",e)}},e.prototype.setOption=e.prototype.slickSetOption=function(){var e,t,o,s,n,r=this,l=!1;if("object"===i.type(arguments[0])?(o=arguments[0],l=arguments[1],n="multiple"):"string"===i.type(arguments[0])&&(o=arguments[0],s=arguments[1],l=arguments[2],"responsive"===arguments[0]&&"array"===i.type(arguments[1])?n="responsive":void 0!==arguments[1]&&(n="single")),"single"===n)r.options[o]=s;else if("multiple"===n)i.each(o,function(i,e){r.options[i]=e});else if("responsive"===n)for(t in s)if("array"!==i.type(r.options.responsive))r.options.responsive=[s[t]];else{for(e=r.options.responsive.length-1;e>=0;)r.options.responsive[e].breakpoint===s[t].breakpoint&&r.options.responsive.splice(e,1),e--;r.options.responsive.push(s[t])}l&&(r.unload(),r.reinit())},e.prototype.setPosition=function(){var i=this;i.setDimensions(),i.setHeight(),!1===i.options.fade?i.setCSS(i.getLeft(i.currentSlide)):i.setFade(),i.$slider.trigger("setPosition",[i])},e.prototype.setProps=function(){var i=this,e=document.body.style;i.positionProp=!0===i.options.vertical?"top":"left","top"===i.positionProp?i.$slider.addClass("slick-vertical"):i.$slider.removeClass("slick-vertical"),void 0===e.WebkitTransition&&void 0===e.MozTransition&&void 0===e.msTransition||!0===i.options.useCSS&&(i.cssTransitions=!0),i.options.fade&&("number"==typeof i.options.zIndex?i.options.zIndex<3&&(i.options.zIndex=3):i.options.zIndex=i.defaults.zIndex),void 0!==e.OTransform&&(i.animType="OTransform",i.transformType="-o-transform",i.transitionType="OTransition",void 0===e.perspectiveProperty&&void 0===e.webkitPerspective&&(i.animType=!1)),void 0!==e.MozTransform&&(i.animType="MozTransform",i.transformType="-moz-transform",i.transitionType="MozTransition",void 0===e.perspectiveProperty&&void 0===e.MozPerspective&&(i.animType=!1)),void 0!==e.webkitTransform&&(i.animType="webkitTransform",i.transformType="-webkit-transform",i.transitionType="webkitTransition",void 0===e.perspectiveProperty&&void 0===e.webkitPerspective&&(i.animType=!1)),void 0!==e.msTransform&&(i.animType="msTransform",i.transformType="-ms-transform",i.transitionType="msTransition",void 0===e.msTransform&&(i.animType=!1)),void 0!==e.transform&&!1!==i.animType&&(i.animType="transform",i.transformType="transform",i.transitionType="transition"),i.transformsEnabled=i.options.useTransform&&null!==i.animType&&!1!==i.animType},e.prototype.setSlideClasses=function(i){var e,t,o,s,n=this;if(t=n.$slider.find(".slick-slide").removeClass("slick-active slick-center slick-current").attr("aria-hidden","true"),n.$slides.eq(i).addClass("slick-current"),!0===n.options.centerMode){var r=n.options.slidesToShow%2==0?1:0;e=Math.floor(n.options.slidesToShow/2),!0===n.options.infinite&&(i>=e&&i<=n.slideCount-1-e?n.$slides.slice(i-e+r,i+e+1).addClass("slick-active").attr("aria-hidden","false"):(o=n.options.slidesToShow+i,t.slice(o-e+1+r,o+e+2).addClass("slick-active").attr("aria-hidden","false")),0===i?t.eq(t.length-1-n.options.slidesToShow).addClass("slick-center"):i===n.slideCount-1&&t.eq(n.options.slidesToShow).addClass("slick-center")),n.$slides.eq(i).addClass("slick-center")}else i>=0&&i<=n.slideCount-n.options.slidesToShow?n.$slides.slice(i,i+n.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"):t.length<=n.options.slidesToShow?t.addClass("slick-active").attr("aria-hidden","false"):(s=n.slideCount%n.options.slidesToShow,o=!0===n.options.infinite?n.options.slidesToShow+i:i,n.options.slidesToShow==n.options.slidesToScroll&&n.slideCount-i<n.options.slidesToShow?t.slice(o-(n.options.slidesToShow-s),o+s).addClass("slick-active").attr("aria-hidden","false"):t.slice(o,o+n.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"));"ondemand"!==n.options.lazyLoad&&"anticipated"!==n.options.lazyLoad||n.lazyLoad()},e.prototype.setupInfinite=function(){var e,t,o,s=this;if(!0===s.options.fade&&(s.options.centerMode=!1),!0===s.options.infinite&&!1===s.options.fade&&(t=null,s.slideCount>s.options.slidesToShow)){for(o=!0===s.options.centerMode?s.options.slidesToShow+1:s.options.slidesToShow,e=s.slideCount;e>s.slideCount-o;e-=1)t=e-1,i(s.$slides[t]).clone(!0).attr("id","").attr("data-slick-index",t-s.slideCount).prependTo(s.$slideTrack).addClass("slick-cloned");for(e=0;e<o+s.slideCount;e+=1)t=e,i(s.$slides[t]).clone(!0).attr("id","").attr("data-slick-index",t+s.slideCount).appendTo(s.$slideTrack).addClass("slick-cloned");s.$slideTrack.find(".slick-cloned").find("[id]").each(function(){i(this).attr("id","")})}},e.prototype.interrupt=function(i){var e=this;i||e.autoPlay(),e.interrupted=i},e.prototype.selectHandler=function(e){var t=this,o=i(e.target).is(".slick-slide")?i(e.target):i(e.target).parents(".slick-slide"),s=parseInt(o.attr("data-slick-index"));s||(s=0),t.slideCount<=t.options.slidesToShow?t.slideHandler(s,!1,!0):t.slideHandler(s)},e.prototype.slideHandler=function(i,e,t){var o,s,n,r,l,d=null,a=this;if(e=e||!1,!(!0===a.animating&&!0===a.options.waitForAnimate||!0===a.options.fade&&a.currentSlide===i))if(!1===e&&a.asNavFor(i),o=i,d=a.getLeft(o),r=a.getLeft(a.currentSlide),a.currentLeft=null===a.swipeLeft?r:a.swipeLeft,!1===a.options.infinite&&!1===a.options.centerMode&&(i<0||i>a.getDotCount()*a.options.slidesToScroll))!1===a.options.fade&&(o=a.currentSlide,!0!==t?a.animateSlide(r,function(){a.postSlide(o)}):a.postSlide(o));else if(!1===a.options.infinite&&!0===a.options.centerMode&&(i<0||i>a.slideCount-a.options.slidesToScroll))!1===a.options.fade&&(o=a.currentSlide,!0!==t?a.animateSlide(r,function(){a.postSlide(o)}):a.postSlide(o));else{if(a.options.autoplay&&clearInterval(a.autoPlayTimer),s=o<0?a.slideCount%a.options.slidesToScroll!=0?a.slideCount-a.slideCount%a.options.slidesToScroll:a.slideCount+o:o>=a.slideCount?a.slideCount%a.options.slidesToScroll!=0?0:o-a.slideCount:o,a.animating=!0,a.$slider.trigger("beforeChange",[a,a.currentSlide,s]),n=a.currentSlide,a.currentSlide=s,a.setSlideClasses(a.currentSlide),a.options.asNavFor&&(l=(l=a.getNavTarget()).slick("getSlick")).slideCount<=l.options.slidesToShow&&l.setSlideClasses(a.currentSlide),a.updateDots(),a.updateArrows(),!0===a.options.fade)return!0!==t?(a.fadeSlideOut(n),a.fadeSlide(s,function(){a.postSlide(s)})):a.postSlide(s),void a.animateHeight();!0!==t?a.animateSlide(d,function(){a.postSlide(s)}):a.postSlide(s)}},e.prototype.startLoad=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.hide(),i.$nextArrow.hide()),!0===i.options.dots&&i.slideCount>i.options.slidesToShow&&i.$dots.hide(),i.$slider.addClass("slick-loading")},e.prototype.swipeDirection=function(){var i,e,t,o,s=this;return i=s.touchObject.startX-s.touchObject.curX,e=s.touchObject.startY-s.touchObject.curY,t=Math.atan2(e,i),(o=Math.round(180*t/Math.PI))<0&&(o=360-Math.abs(o)),o<=45&&o>=0?!1===s.options.rtl?"left":"right":o<=360&&o>=315?!1===s.options.rtl?"left":"right":o>=135&&o<=225?!1===s.options.rtl?"right":"left":!0===s.options.verticalSwiping?o>=35&&o<=135?"down":"up":"vertical"},e.prototype.swipeEnd=function(i){var e,t,o=this;if(o.dragging=!1,o.swiping=!1,o.scrolling)return o.scrolling=!1,!1;if(o.interrupted=!1,o.shouldClick=!(o.touchObject.swipeLength>10),void 0===o.touchObject.curX)return!1;if(!0===o.touchObject.edgeHit&&o.$slider.trigger("edge",[o,o.swipeDirection()]),o.touchObject.swipeLength>=o.touchObject.minSwipe){switch(t=o.swipeDirection()){case"left":case"down":e=o.options.swipeToSlide?o.checkNavigable(o.currentSlide+o.getSlideCount()):o.currentSlide+o.getSlideCount(),o.currentDirection=0;break;case"right":case"up":e=o.options.swipeToSlide?o.checkNavigable(o.currentSlide-o.getSlideCount()):o.currentSlide-o.getSlideCount(),o.currentDirection=1}"vertical"!=t&&(o.slideHandler(e),o.touchObject={},o.$slider.trigger("swipe",[o,t]))}else o.touchObject.startX!==o.touchObject.curX&&(o.slideHandler(o.currentSlide),o.touchObject={})},e.prototype.swipeHandler=function(i){var e=this;if(!(!1===e.options.swipe||"ontouchend"in document&&!1===e.options.swipe||!1===e.options.draggable&&-1!==i.type.indexOf("mouse")))switch(e.touchObject.fingerCount=i.originalEvent&&void 0!==i.originalEvent.touches?i.originalEvent.touches.length:1,e.touchObject.minSwipe=e.listWidth/e.options.touchThreshold,!0===e.options.verticalSwiping&&(e.touchObject.minSwipe=e.listHeight/e.options.touchThreshold),i.data.action){case"start":e.swipeStart(i);break;case"move":e.swipeMove(i);break;case"end":e.swipeEnd(i)}},e.prototype.swipeMove=function(i){var e,t,o,s,n,r,l=this;return n=void 0!==i.originalEvent?i.originalEvent.touches:null,!(!l.dragging||l.scrolling||n&&1!==n.length)&&(e=l.getLeft(l.currentSlide),l.touchObject.curX=void 0!==n?n[0].pageX:i.clientX,l.touchObject.curY=void 0!==n?n[0].pageY:i.clientY,l.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(l.touchObject.curX-l.touchObject.startX,2))),r=Math.round(Math.sqrt(Math.pow(l.touchObject.curY-l.touchObject.startY,2))),!l.options.verticalSwiping&&!l.swiping&&r>4?(l.scrolling=!0,!1):(!0===l.options.verticalSwiping&&(l.touchObject.swipeLength=r),t=l.swipeDirection(),void 0!==i.originalEvent&&l.touchObject.swipeLength>4&&(l.swiping=!0,i.preventDefault()),s=(!1===l.options.rtl?1:-1)*(l.touchObject.curX>l.touchObject.startX?1:-1),!0===l.options.verticalSwiping&&(s=l.touchObject.curY>l.touchObject.startY?1:-1),o=l.touchObject.swipeLength,l.touchObject.edgeHit=!1,!1===l.options.infinite&&(0===l.currentSlide&&"right"===t||l.currentSlide>=l.getDotCount()&&"left"===t)&&(o=l.touchObject.swipeLength*l.options.edgeFriction,l.touchObject.edgeHit=!0),!1===l.options.vertical?l.swipeLeft=e+o*s:l.swipeLeft=e+o*(l.$list.height()/l.listWidth)*s,!0===l.options.verticalSwiping&&(l.swipeLeft=e+o*s),!0!==l.options.fade&&!1!==l.options.touchMove&&(!0===l.animating?(l.swipeLeft=null,!1):void l.setCSS(l.swipeLeft))))},e.prototype.swipeStart=function(i){var e,t=this;if(t.interrupted=!0,1!==t.touchObject.fingerCount||t.slideCount<=t.options.slidesToShow)return t.touchObject={},!1;void 0!==i.originalEvent&&void 0!==i.originalEvent.touches&&(e=i.originalEvent.touches[0]),t.touchObject.startX=t.touchObject.curX=void 0!==e?e.pageX:i.clientX,t.touchObject.startY=t.touchObject.curY=void 0!==e?e.pageY:i.clientY,t.dragging=!0},e.prototype.unfilterSlides=e.prototype.slickUnfilter=function(){var i=this;null!==i.$slidesCache&&(i.unload(),i.$slideTrack.children(this.options.slide).detach(),i.$slidesCache.appendTo(i.$slideTrack),i.reinit())},e.prototype.unload=function(){var e=this;i(".slick-cloned",e.$slider).remove(),e.$dots&&e.$dots.remove(),e.$prevArrow&&e.htmlExpr.test(e.options.prevArrow)&&e.$prevArrow.remove(),e.$nextArrow&&e.htmlExpr.test(e.options.nextArrow)&&e.$nextArrow.remove(),e.$slides.removeClass("slick-slide slick-active slick-visible slick-current").attr("aria-hidden","true").css("width","")},e.prototype.unslick=function(i){var e=this;e.$slider.trigger("unslick",[e,i]),e.destroy()},e.prototype.updateArrows=function(){var i=this;Math.floor(i.options.slidesToShow/2),!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&!i.options.infinite&&(i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false"),i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false"),0===i.currentSlide?(i.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false")):i.currentSlide>=i.slideCount-i.options.slidesToShow&&!1===i.options.centerMode?(i.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")):i.currentSlide>=i.slideCount-1&&!0===i.options.centerMode&&(i.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")))},e.prototype.updateDots=function(){var i=this;null!==i.$dots&&(i.$dots.find("li").removeClass("slick-active").end(),i.$dots.find("li").eq(Math.floor(i.currentSlide/i.options.slidesToScroll)).addClass("slick-active"))},e.prototype.visibility=function(){var i=this;i.options.autoplay&&(document[i.hidden]?i.interrupted=!0:i.interrupted=!1)},i.fn.slick=function(){var i,t,o=this,s=arguments[0],n=Array.prototype.slice.call(arguments,1),r=o.length;for(i=0;i<r;i++)if("object"==typeof s||void 0===s?o[i].slick=new e(o[i],s):t=o[i].slick[s].apply(o[i].slick,n),void 0!==t)return t;return o}});
  ;
  Element.prototype.insertChildAtIndex = function(child, index) {
    if (!index) index = 0
    if (index >= this.children.length) {
      this.appendChild(child)
    } else {
      this.insertBefore(child, this.children[index])
    }
  }
  
  function getImages()
  {
      var content = document.getElementById("single-post");
      if (content == null){
          return;
      }
      
      var sliderElement = document.getElementById("myModalContent");
      
      var images = content.getElementsByTagName('img');
      for (index = 0, len = images.length; index < len; ++index) {
          var imgageElement = images[index];
          imgageElement.index = index;		
          imgageElement.addEventListener("click", function (e) { 
                      openModal();					
                      currentSlide(e.currentTarget.index  + 1);
                  }, false);
          imgageElement.className += " hover-shadow cursor";
          
          var src = imgageElement.src;
        
          var innerDiv = document.createElement('div');
          innerDiv.className = 'mySlides';
          
          var innerDivNumber = document.createElement('div');
          innerDivNumber.className = 'numbertext';
          innerDivNumber.innerHTML = (index + 1) + "/" + len;
          innerDiv.appendChild(innerDivNumber);
          
          var img = document.createElement("img");
          img.setAttribute("src", src);
          img.style.display = "block";		
          innerDiv.appendChild(img);
          
          sliderElement.insertChildAtIndex(innerDiv, index)
      
      } 
  
      jQuery("#social-link-container-horizantal").prependTo("#social-link-container-horizantal-details");
  }
  
  function openModal() {
    document.getElementById('myModal').style.display = "block";
  }
  
  function closeModal() {
    document.getElementById('myModal').style.display = "none";
  }
  
  function plusSlides(n) {
    showSlides(window.slideIndex += n);
  }
  
  function currentSlide(n) {
    showSlides(window.slideIndex = n);
  }
  
  function showSlides(n) {
  
    var i;
    var slides = document.getElementsByClassName("mySlides");
    var captionText = document.getElementById("caption");
    if (n > slides.length) {window.slideIndex = 1}
    if (n < 1) {window.slideIndex = slides.length}
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
  
    console.log(slides[window.slideIndex-1]);
    slides[window.slideIndex-1].style.display = "block";
  };
  /**
   * Modern News Ticker
   * Copyright (c) CreativeTier
   * contact@CreativeTier.com
   * www.CreativeTier.com
   */
  (function(e){var t={effect:"scroll",autoplay:true,feedType:"none",feedCount:5,refresh:"10:00"};var n={scroll:{scrollInterval:20,transitionTime:500},fade:{displayTime:4e3,transitionTime:300},type:{typeInterval:10,displayTime:4e3,transitionTime:300},slide:{slideDistance:100,displayTime:4e3,transitionTime:350}};var r={"rss-atom":{feedUrl:""},twitter:{twitterName:""}};var i={init:function(t){var i={};e.extend(i,{feedType:t.feedType});e.extend(i,r[i.feedType]);e.extend(i,{effect:t.effect});e.extend(i,n[i.effect]);e.extend(i,t);return this.each(function(){function w(){A();p.addClass("mt-hide");h.addClass("mt-preloader");p.children().remove();p.css("margin-left",0);d.css("opacity","1").removeClass("mt-hide");p.append(d);switch(i.feedType){case"rss-atom":e.ajax({url:"https://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num="+i.feedCount+"&q="+i.feedUrl,type:"GET",dataType:"jsonp",success:function(e){var t=e.responseData.feed.entries;for(var n=0;n<t.length;n++){p.append("<li><a href='"+t[n].link+"' target='_blank'>"+t[n].title+"</a></li>")}E()}});break;case"twitter":e.ajax({url:"http://api.twitter.com/1/statuses/user_timeline.json",type:"GET",dataType:"jsonp",data:{screen_name:i.twitterName,count:i.feedCount,trim_user:true},success:function(e){for(var t=0;t<e.length;t++){p.append("<li><a href='http://twitter.com/#!/"+e[t].user.id_str+"/status/"+e[t].id_str+"' target='_blank'>"+e[t].text+"</a></li>")}E()}});break}}function E(){h.removeClass("mt-preloader");p.removeClass("mt-hide");x()}function S(){if(i.feedType=="rss-atom"||i.feedType=="twitter"){clearTimeout(f);a=false;w()}}function x(){if(i.effect!="scroll")p.children("li:not(:first)").addClass("mt-hide");if(u){u=false;if(i.autoplay){k();_()}}else O();if(i.refresh){f=setTimeout(S,T(i.refresh))}a=true}function T(e){var t;if(typeof e=="number")t=e;else{var n=e.split(":");n.reverse();t=parseFloat(n[0]);if(n[1])t+=parseFloat(n[1])*60;if(n[2])t+=parseFloat(n[2])*3600}return t*1e3}function N(e){if(a)C(e.data.type)}function C(t){if(!s){s=true;A();if(t=="prev"){switch(i.effect){case"scroll":p.css({"margin-left":-e(p.children(":last")).outerWidth()}).children(":last").prependTo(p);p.animate({"margin-left":0},i.transitionTime,function(){s=false;m.mouseleave(function(){O()})});break;case"fade":p.children(":first").animate({opacity:0},i.transitionTime,function(){e(this).addClass("mt-hide");p.children(":last").prependTo(p).removeClass("mt-hide").css({opacity:0}).animate({opacity:1},i.transitionTime,function(){O()});s=false});break;case"type":p.children(":first").animate({opacity:0},i.transitionTime,function(){e(this).addClass("mt-hide");M(p.children(":last").prependTo(p).removeClass("mt-hide").css({opacity:0}).animate({opacity:1},i.transitionTime).children("a"));s=false});break;case"slide":p.children(":first").animate({opacity:0},i.transitionTime,function(){e(this).addClass("mt-hide");p.children(":last").prependTo(p).removeClass("mt-hide").css({opacity:0,"margin-left":i.slideDistance}).animate({opacity:1,"margin-left":0},i.transitionTime,function(){O()});s=false});break}}else{switch(i.effect){case"scroll":p.animate({"margin-left":-e(p.children(":first")).outerWidth()},i.transitionTime,function(){p.css("margin-left",0).children(":first").appendTo(p);s=false;g.mouseleave(function(){O()})});break;case"fade":p.children(":first").animate({opacity:0},i.transitionTime,function(){e(this).addClass("mt-hide").appendTo(p);p.children(":first").removeClass("mt-hide").css({opacity:0}).animate({opacity:1},i.transitionTime,function(){O()});s=false});break;case"type":p.children(":first").animate({opacity:0},i.transitionTime,function(){e(this).addClass("mt-hide").appendTo(p);M(p.children(":first").removeClass("mt-hide").css({opacity:0}).animate({opacity:1},i.transitionTime).children("a"));s=false});break;case"slide":p.children(":first").animate({opacity:0},i.transitionTime,function(){e(this).addClass("mt-hide").appendTo(p);p.children(":first").removeClass("mt-hide").css({opacity:0,"margin-left":i.slideDistance}).animate({opacity:1,"margin-left":0},i.transitionTime,function(){O()});s=false});break}}}}function k(){n=true;if(i.effect=="scroll"){t=setInterval(function(){var t=parseFloat(p.css("margin-left"))-1;p.css("margin-left",t);if(Math.abs(t)>e(p.children("li")[0]).outerWidth()){p.css("margin-left",0).children(":first").appendTo(p)}},i.scrollInterval)}else{t=setInterval(function(){C("next")},i.displayTime)}}function L(){n=false;clearInterval(t)}function A(){if(n){r=true;L()}}function O(){if(r&&!o){k();r=false}}function M(e){var t=e.html().split("");var n=0;e.html("_");var r=setInterval(function(){var i=e.html().split("_")[0]+t[n++];if(n!=t.length){i+="_"}e.html(i);if(n==t.length){clearInterval(r);O()}},i.typeInterval)}function _(){y.addClass("mt-pause")}function D(){y.removeClass("mt-pause")}function P(){return false}var t;var n=false;var r=false;var s=false;var o=false;var u=true;var a=false;var f;var l=e(this);var c=l.children(".mt-label");var h=l.children(".mt-news");var p=h.children("ul");var d=p.children("li");var v=l.children(".mt-controls");var m=v.children(".mt-prev");var g=v.children(".mt-next");var y=v.children(".mt-play");if(i.effect=="scroll")l.addClass("mt-scroll");c.css("width",c.width());var b=l.width();if(c.length)b-=c.outerWidth()+parseFloat(c.css("margin-right"));if(v.length)b-=v.outerWidth()+parseFloat(v.css("margin-left"));h.css("width",b);m.mousedown(P).bind("click",{type:"prev"},N);g.mousedown(P).bind("click",{type:"next"},N);y.mousedown(P).click(function(){if(a){if(n){L();D()}else{k();_()}}});if(i.feedType=="rss-atom"||i.feedType=="twitter"){w()}else{x()}l.data("pause",A);l.data("resume",O);l.data("refresh",S)})},pause:function(){return this.each(function(){e(this).data("pause")()})},resume:function(){return this.each(function(){e(this).data("resume")()})},refresh:function(){return this.each(function(){e(this).data("refresh")()})}};e.fn.modernTicker=function(t){if(i[t]){return i[t].apply(this,Array.prototype.slice.call(arguments,1))}else if(typeof t==="object"||!t){return i.init.apply(this,arguments)}else{e.error("Method "+t+" does not exist on jQuery.modernTicker")}}})(jQuery)
  ;
  (function($){
      $(window).resize(function() {
  
  
      });
      $(document).ready(function() {
  
          var scrollWidth = 0;
          var innerWidth = 0;
          // mobile indicator
          var innerWidth = $('.breaking-news-section .sub-menu-wrap').innerWidth();
  
          if (typeof $('.sub-menu-wrap')[0] != 'undefined') {
              var scrollWidth = $('.sub-menu-wrap')[0].scrollWidth;
          }
  
          var isGreenBar = false;
  
  
          idev_mobile_menu_indicator(0, innerWidth, scrollWidth,isGreenBar);
          $('.sub-menu-wrap').scroll(function (e) {
              idev_mobile_menu_indicator($(this).scrollLeft(), innerWidth, scrollWidth,isGreenBar);
          });
  
          $('.call-open-comment').click(function(event) {
              $('#comments').toggle();
          });
          $('.marquee').marquee({
              pauseOnHover: true
          });
  
          $('.call-show-search, .search-title').click(function(event) {
              showSearchBox($(this),'open');
          });
          $('.close-search-box').click(function(event) {
              showSearchBox($(this),'close');
          });
  
  
  
  
          formValidate();
          fixedHeader();
          fixedToolbar();
          addGreenBar(innerWidth,scrollWidth);
          // Sections backgrounds
  
          var pageSection = $(".home-section, .page-section, .small-section, .split-section");
          pageSection.each(function(indx){
  
              if ($(this).attr("data-background")){
                  $(this).css("background-image", "url(" + $(this).data("background") + ")");
              }
          });
  
          // Rotate Finance widget every 5 seconds
          setInterval(rotateFinancialWidget, 5000);
          window.selectedType = "1";
  
  
          // Rotate homepage 5 seconds
          rotateHomepageArticle();
  
          // Decalare for slider on article detailed page
          getImages();
          $("#social-link-event").prependTo($("#ssc-buttons-event"));
  
          // Change date on Homepage
          $("#topCurrentDate").text(getFormattedDate(new Date()));
  
          buildMobileFooter();
  
          // Adjust the home page
          try{
              // Temporary solution to adjust the ...
              jQuery(".post-title.title-desc.title-sumary").width('99.9%');
  
              /*fix bug section energy on frontpage*/
              jQuery(".home_energy_view-zone .post-title.title-desc.title-sumary").width('100.1%');
              //jQuery(".post-desc").width('99.9%');
              jQuery(".home_lead_stories-zone .title-lead-stories").width('99.9%');
  
              jQuery(".home-video-latest .article-home-leadwomen .title-home-leadwomen").width('49%');
          }
          catch(e){}
  
          $("#youtube-button-overlay").on("click", function(){
              $(this).parents(".main-home-video").find("a:first").trigger("click");
          });
      });
  
      function idev_mobile_menu_indicator(scrollLeft, innerWidth, scrollWidth, isGreenBar) {
          var red = scrollLeft + innerWidth + 3;
          var is_scroll = (innerWidth < scrollWidth);
  
          //console.log(is_scroll);
          if (is_scroll) {
              if (scrollLeft === 0) {
                  $('.indicator-left').hide();
                  $('.indicator-right').show();
              } else if (scrollLeft > 0 && red < scrollWidth) {
                  $('.indicator-left').show();
                  $('.indicator-right').show();
              }else{
                  $('.indicator-left').show();
                  $('.indicator-right').hide();
              }
          }
      }
  
      function buildMobileFooter(){
          var $widFooter = $(".footer-toggle-menu").closest(".widget-container");
          //console.log($widFooter);
          $widFooter.each(function(){
              if ($(this).hasClass(".menu-nav-help-container")) {
                  $(this).find(".footer-toggle-menu").css("display","none");
              }
          });
  
          $(".menu-nav-help-container").closest(".widget-container").find(".footer-toggle-menu").addClass("footer-toggle-menu-dsplay");
          $(".footer-toggle-menu").click(function(event) {
              if ($(this).find("li").hasClass('fa-chevron-down'))
              {
                  $(this).find("li").removeClass("fa-chevron-down").addClass("fa-chevron-up");
              }else{
                  $(this).find("li").removeClass("fa-chevron-up").addClass("fa-chevron-down");
              }
              $(this).closest(".widget-container").find(".menu-nav-help-container").toggle();
  
          });
      }
  
  
      /**
      * Rotate Finance widget every 5 seconds
      */
      function rotateFinancialWidget() {
          if (window.selectedType == "1"){
              $('.tap-financel-item-container[type="1"]').css('display', '');
              $('.tap-financel-item-container[type="2"]').css('display', 'none');
              $('.tap-financel-item-container[type="3"]').css('display', 'none');
              $('.tap-financel-item-container[type="4"]').css('display', 'none');
              window.selectedType = "2";
          } else if (window.selectedType == "2"){
              $('.tap-financel-item-container[type="1"]').css('display', 'none');
              $('.tap-financel-item-container[type="2"]').css('display', '');
              $('.tap-financel-item-container[type="3"]').css('display', 'none');
              $('.tap-financel-item-container[type="4"]').css('display', 'none');
              window.selectedType = "3";
          } else if (window.selectedType == "3"){
              $('.tap-financel-item-container[type="1"]').css('display', 'none');
              $('.tap-financel-item-container[type="2"]').css('display', 'none');
              $('.tap-financel-item-container[type="3"]').css('display', '');
              $('.tap-financel-item-container[type="4"]').css('display', 'none');
              window.selectedType = "4";
          } else if (window.selectedType == "4"){
              $('.tap-financel-item-container[type="1"]').css('display', 'none');
              $('.tap-financel-item-container[type="2"]').css('display', 'none');
              $('.tap-financel-item-container[type="3"]').css('display', 'none');
              $('.tap-financel-item-container[type="4"]').css('display', '');
              window.selectedType = "1";
          }
      }
  
      /**
      * Rotate homepage 5 seconds
      */
      function rotateHomepageArticle() {
          var articles = jQuery(".article-style-slider");
          if (articles != null && articles.length > 0){
              var activeItem  = jQuery(".article-style-slider.top-story-active");
  
              var activeIndex = articles.index(activeItem);
              activeItem.removeClass("top-story-active");
              var nextIndex = activeIndex + 1;
              if (nextIndex >= articles.length){
                  nextIndex =  0;
              }
              jQuery(articles[nextIndex]).addClass("top-story-active");
  
              var leadStories = jQuery(".home_lead_stories-zone li");
              var nextselectedIndex =  nextIndex;
              if (nextIndex == 0 && articles.length == leadStories.length)
              {
                  nextselectedIndex = nextIndex;
              }
              var selectedStory = leadStories[nextselectedIndex];
              jQuery(leadStories[activeIndex]).children().removeClass('lead-story-active');
              jQuery(selectedStory).children().addClass('lead-story-active');
          }
          setTimeout(rotateHomepageArticle, 5000);
      }
  
      function getFormattedDate(today)
      {
          var week = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
          var month = new Array('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December');
          var day  = week[today.getDay()];
          var dd   = today.getDate();
          var mm   = month[today.getMonth()]; //January is 0!
          var yyyy = today.getFullYear();
          var hour = today.getHours();
          var minu = today.getMinutes();
  
          return day + ', ' + dd + ' '+ mm + ' ' + yyyy
      }
  
  
      /**
      * validate form
      */
      function formValidate(){
          $('#subscribeForm').parsley();
      }
  
      /**
      * Show/hide search box
      */
      function showSearchBox($el, action){
          switch(action) {
              case 'open':
                  $('.form-search-block').addClass('fadeIn active');
                  $('.form-search-block').find('input[type="text"]').focus();
                  $('body').addClass('overhidden');
              break;
              case 'close':
                  $('.form-search-block').removeClass('active');
                  $('body').removeClass('overhidden');
              break;
          }
  
      }
  
      /**
      * Fix header when scroll
      */
      function fixedHeader() {
  
          $('.breaking-news-section').waypoint(function(direction){
  
              if (direction == "up") {
                  // scroll down
                  $('.fixed-header').removeClass('show').removeClass('fadeInDown');
              } else if (direction == "down") {
                  // scroll down
                  $('.fixed-header').addClass('show').addClass('fadeInDown');
              }
          }, {
              offset: 0
          });
      }
      /**
      * add Greenbar to Submenu Header
      */
      function addGreenBar(innerWidth,scrollWidth){
  
          //console.log(innerWidth);
  
          $(".breadcrumb").clone().appendTo( $("#breadcrumb-content") );
          var greenBarWidth = innerWidth+"px";
          var greenBarscrollWidth = scrollWidth;
          $('.breaking-news-section-1 .breadcrumb').css("width",greenBarWidth);
          //$('.breaking-news-section-1 .sub-menu-wrap').css("width","599px");
  
          var innerWidthGreenBar = $('.breaking-news-section-1 .breadcrumb').innerWidth();
          //var scrollWidth = $('.breaking-news-section-1 .sub-menu-wrap')[0].scrollWidth;
          //var scrollWidth = scrollWidth;
  
          var isGreenBar = true;
          if ($('.breaking-news-section-1').length > 0) {
              idev_mobile_menu_indicator(0, innerWidthGreenBar, greenBarscrollWidth, isGreenBar);
          }
          $('.breaking-news-section-1 .sub-menu-wrap').scroll(function (e) {
              idev_mobile_menu_indicator($(this).scrollLeft(), innerWidthGreenBar, greenBarscrollWidth,isGreenBar);
          });
      }
      /**
      * Fix share toolbar when scroll
      */
      function fixedToolbar() {
  
          $('.single-post .single-post-heading .title-desc').waypoint(function(direction){
              if (direction == "up") {
                  // scroll down
                  $('.sidebar-share').removeClass('show');
              } else if (direction == "down") {
                  // scroll down
                  $('.sidebar-share').addClass('show').addClass('fadeIn');
              }
          }, {
              offset: 0
          });
      }
  
       /**
      * Change height dynamic, fixed footer if need
      */
      function fixedFooter() {
          $('#master').css('min-height', 0);
          var heightNeed = 0;
          // Caculate height, do no included padding
          heightNeed = $(window).height() - ( $('#header').height() + $('#footer').height() + $('#toolbar').height() );
  
          if ( $('#wpadminbar').length ) {
              heightNeed -= $('#wpadminbar').height();
          }
          $('#master').css('min-height',heightNeed - 30);
      }
  
      /* --------------------------------------------
       Platform detect
       --------------------------------------------- */
      var mobileTest;
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
          mobileTest = true;
          $("html").addClass("mobile");
      }
      else {
          mobileTest = false;
          $("html").addClass("no-mobile");
      }
  
      var mozillaTest;
      if (/mozilla/.test(navigator.userAgent)) {
          mozillaTest = true;
      }
      else {
          mozillaTest = false;
      }
      var safariTest;
      if (/safari/.test(navigator.userAgent)) {
          safariTest = true;
      }
      else {
          safariTest = false;
      }
  
      // Detect touch devices
      if (!("ontouchstart" in document.documentElement)) {
          document.documentElement.className += " no-touch";
      }
  
      $('.slider-for').slick({
          /*autoplay: true,*/
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: false,
          fade: true,
          asNavFor: '.slider-nav'
      });
      $('.slider-nav').slick({
          slidesToShow: 2,
          slidesToScroll: 1,
          asNavFor: '.slider-for',
          dots: false,
          //centerMode: true,
          focusOnSelect: true,
          prevArrow: '<button type="button" class="slick-prev"><i class="fa fa-angle-left" style="font-size:36px;color: #ffffff"></i></button>',
          nextArrow: '<button type="button" class="slick-next"><i class="fa fa-angle-right" style="font-size:36px;color: #ffffff"></i></button>',
          responsive: [
              {
                  breakpoint: 768,
                  settings: {
                      slidesToShow: 2
                  }
              },
              {
                  breakpoint: 480,
                  settings: {
                      slidesToShow: 1
                  }
              }
          ]
      });
  
      $('.multiple-items').not(".loopable").slick({
  
          infinite: false,
          centerPadding: '60px',
          slidesToShow: 2,
          slidesToScroll: 1,
  
          prevArrow: '<button type="button" class="slick-prev"><i class="fa fa-angle-left" style="font-size:36px;color: #ffffff"></i></button>',
          nextArrow: '<button type="button" class="slick-next"><i class="fa fa-angle-right" style="font-size:36px;color: #ffffff"></i></button>',
          responsive: [
              {
                  breakpoint: 768,
                  settings: {
                      slidesToShow: 2
                  }
              },
              {
                  breakpoint: 480,
                  settings: {
                      slidesToShow: 1
                  }
              }
          ]
      });
  
      $('.multiple-items.loopable').slick({
          centerPadding: '60px',
          slidesToShow: 2,
          slidesToScroll: 1,
  
          prevArrow: '<button type="button" class="slick-prev video-slick-button"><i class="fa fa-angle-left" style="font-size:36px;color: #ffffff"></i></button>',
          nextArrow: '<button type="button" class="slick-next video-slick-button"><i class="fa fa-angle-right" style="font-size:36px;color: #ffffff"></i></button>',
          responsive: [
              {
                  breakpoint: 768,
                  settings: {
                      slidesToShow: 2
                  }
              },
              {
                  breakpoint: 480,
                  settings: {
                      slidesToShow: 1
                  }
              }
          ]
      });
  
      $(".video-slick-button").on("click", function(){
          var parent = $(this).parents("#youtubechannel-list");
          if (parent.length > 0) {
              var slickCurrent = parent.find(".slick-current");
              var videoId = slickCurrent.find("a:first").attr("href");
              youtubechannel_setvideo(videoId);
          }
      });
          var bodyWidth = jQuery("body").width();
          if (bodyWidth > 667) {
              $(".youtube").colorbox({iframe:true, innerWidth:640, innerHeight:390, overlayClose: false, closeButton: true});
          } else {
              var innerHeight = (((bodyWidth*9)/10) * 9) / 16;
              $(".youtube").colorbox({iframe:true, innerWidth: "90%", innerHeight: innerHeight, overlayClose: false, closeButton: true});
          }
          var youtubeImageHeight = ((bodyWidth - 20)*9)/16;
          $("img#youtubechannel-image").css({height: youtubeImageHeight + "px!important"});
  
      $('.image-slider').not('.slick-initialized').slick({
          autoplay: true,
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: false,
          fade: true,
          asNavFor: '.image-slider-nav'
          //centerPadding: '60px',
          //prevArrow: '<button type="button" class="slick-prev"><i class="fa fa-angle-left" style="font-size:36px;color: #ffffff"></i></button>',
          //nextArrow: '<button type="button" class="slick-next"><i class="fa fa-angle-right" style="font-size:36px;color: #ffffff"></i></button>',
      });
      $('.image-slider-nav').not('.slick-initialized').slick({
          slidesToShow: 5,
          slidesToScroll: 1,
          asNavFor: '.image-slider',
          //centerMode: true,
          focusOnSelect: true,
          prevArrow: '<button type="button" class="slick-prev"><i class="fa fa-angle-left" style="font-size:36px;color: #ffffff"></i></button>',
          nextArrow: '<button type="button" class="slick-next"><i class="fa fa-angle-right" style="font-size:36px;color: #ffffff"></i></button>',
          responsive: [
              {
                  breakpoint: 768,
                  settings: {
                      slidesToShow: 3
                  }
              },
              {
                  breakpoint: 480,
                  settings: {
                      slidesToShow: 2
                  }
              }
          ]
      });
      function youtubechannel_setvideo(href) {
  
          youtubeid = href.replace("#","");
  
          jQuery('#youtubechannel-frame').attr('src','https://www.youtube.com/embed/' + youtubeid + '?rel=0');
          jQuery('#youtubechannel-frame').attr('href','https://www.youtube.com/embed/' + youtubeid + '?rel=0');
  
          jQuery('#youtubechannel-image').animate({opacity : 0.5}, 200, "linear", function() {
              $(this).css("opacity", 1);
              $(this).attr('src','https://i.ytimg.com/vi/'+youtubeid+'/maxresdefault.jpg' );
          });
  
  
      }
  
      if (jQuery('#youtubechannel-list a:first').length) {
           youtubechannel_setvideo_home(jQuery('#youtubechannel-list .slick-active a:first-child').attr('href'));
            jQuery('#youtubechannel-list a').click(function(e) {
              youtubechannel_setvideo_home(jQuery(this).attr('href'));
              // play the video too
              setTimeout(function(){
                  $(".main-home-video").find("a:first").trigger("click");
              },300);
              return false;
          });
      }
  
      function youtubechannel_setvideo_home(href) {
  
          var youtubeid = href.replace("#","");
          jQuery('#youtubechannel-frame').attr('src','https://www.youtube.com/embed/' + youtubeid + '?rel=0' );
          jQuery('#youtubechannel-frame').attr('href','https://www.youtube.com/embed/' + youtubeid + '?rel=0');
          jQuery('#youtubechannel-image').attr('src','https://i.ytimg.com/vi/'+youtubeid+'/maxresdefault.jpg' );
      }
  
      $(document).bind('cbox_open', function(){
        $('body').css({overflow:'hidden'});
      }).bind('cbox_closed', function(){
        $('body').css({overflow:'auto'});
      });
  
      $(".modern-ticker").modernTicker({
          effect: "scroll",
          scrollInterval: 20,
          transitionTime: 500,
          autoplay: true,
      });
      $("body").on("click", ".video-loadmore", function(){
                  $.ajax({
                      url: Drupal.url('youtubechannel/get_video_channel'),
                      type: 'POST',
                      data: {
                        'page': $(this).data('page'),
                      },
                      dataType: 'json',
                      success: function (results) {
                          $("#main .pager").remove();
                          $("#main").append(results);
                          var bodyWidth = jQuery("body").width();
                          if (bodyWidth > 667) {
                              $(".youtube").colorbox({iframe:true, innerWidth:640, innerHeight:390, overlayClose: false, closeButton: true});
                          } else {
                              var innerHeight = (((bodyWidth*9)/10) * 9) / 16;
                              $(".youtube").colorbox({iframe:true, innerWidth: "90%", innerHeight: innerHeight, overlayClose: false, closeButton: true});
                          }
                          // Text truncate
                          var elems = document.querySelectorAll(".title-desc");
                          for (var i=0; i<elems.length; i++) {
                              $(elems[i]).readMore({
                                  numberOfLines: 2
                              });
                          }
                      }
                  });
                  return false;
              });
  
      // Add ads to middle homepage on mobile
      if ($(".front").length > 0) {
          if ( $( window ).width() <= 768 ) {
              $(".banner .block-ads-system").each(function (index, e) {
                  if (index === 0) {
                          $(".front .sidebar-1").html($(e));
                  } else if (index === 1) {
                          $(".sidebar-2").html($(e));
                  } else if (index === 2) {
                      $(".sidebar-3").html($(e));
                  }
              });
          }
      }
  
      // Add ads to middle of body content on modile
      if ($(".single-post-content").length > 0) {
          var paragraph3 = $(".single-post-content .story_body .para:nth-child(3)");
          var paragraph6 = $(".single-post-content .story_body .para:nth-child(6)");
          var paragraph9 = $(".single-post-content .story_body .para:nth-child(9)");
          paragraph3.after("<div class='hidden-md hidden-lg article-side-mobile-ads-1 article-ads'></div>");
          paragraph6.after("<div class='hidden-md hidden-lg article-side-mobile-ads-2 article-ads'></div>");
          paragraph9.after("<div class='article-middle-ads article-ads'></div>");
  
          if ( $( window ).width() <= 768 ) {
          $(".ads-node .block-ads-system").each(function (index, e) {
              if (index === 0) {
                      $(".article-side-mobile-ads-1").html($(e));
              } else if (index === 1) {
                      $(".article-side-mobile-ads-2").html($(e));
              }
          });
  
          }
          $(".article-middle-ads").html($(".article-middle-ads-tmp").html());
      }
  
  
      $("#contact-message-download-pdf-form").on("submit", function() {//#edit-submit
          $(this).parents(".field").find(".advertising-quote").remove();
          $(this).parents(".field").find(".field__label").remove();
          $(this).parents(".field").siblings(".field--name-body").css('visibility', 'hidden');
          $(this).parents(".field").css({width: '100%', 'border-radius': '0'});
          $(".download-thank-you").removeClass('hidden');
          $(this).css('display', 'none');
      });
  
      $(".contact-message-download-pdf-form .form-actions").before("<div class='advertise-guide'>Fields marked with asterisk(*) are required</div>");
  })(window.jQuery);;
  /**
   * Copyright (c) 2007-2013 Ariel Flesler - aflesler<a>gmail<d>com | http://flesler.blogspot.com
   * Dual licensed under MIT and GPL.
   * @author Ariel Flesler
   * @version 1.4.6
   */
  ;(function($){var h=$.scrollTo=function(a,b,c){$(window).scrollTo(a,b,c)};h.defaults={axis:'xy',duration:parseFloat($.fn.jquery)>=1.3?0:1,limit:true};h.window=function(a){return $(window)._scrollable()};$.fn._scrollable=function(){return this.map(function(){var a=this,isWin=!a.nodeName||$.inArray(a.nodeName.toLowerCase(),['iframe','#document','html','body'])!=-1;if(!isWin)return a;var b=(a.contentWindow||a).document||a.ownerDocument||a;return/webkit/i.test(navigator.userAgent)||b.compatMode=='BackCompat'?b.body:b.documentElement})};$.fn.scrollTo=function(e,f,g){if(typeof f=='object'){g=f;f=0}if(typeof g=='function')g={onAfter:g};if(e=='max')e=9e9;g=$.extend({},h.defaults,g);f=f||g.duration;g.queue=g.queue&&g.axis.length>1;if(g.queue)f/=2;g.offset=both(g.offset);g.over=both(g.over);return this._scrollable().each(function(){if(e==null)return;var d=this,$elem=$(d),targ=e,toff,attr={},win=$elem.is('html,body');switch(typeof targ){case'number':case'string':if(/^([+-]=?)?\d+(\.\d+)?(px|%)?$/.test(targ)){targ=both(targ);break}targ=$(targ,this);if(!targ.length)return;case'object':if(targ.is||targ.style)toff=(targ=$(targ)).offset()}$.each(g.axis.split(''),function(i,a){var b=a=='x'?'Left':'Top',pos=b.toLowerCase(),key='scroll'+b,old=d[key],max=h.max(d,a);if(toff){attr[key]=toff[pos]+(win?0:old-$elem.offset()[pos]);if(g.margin){attr[key]-=parseInt(targ.css('margin'+b))||0;attr[key]-=parseInt(targ.css('border'+b+'Width'))||0}attr[key]+=g.offset[pos]||0;if(g.over[pos])attr[key]+=targ[a=='x'?'width':'height']()*g.over[pos]}else{var c=targ[pos];attr[key]=c.slice&&c.slice(-1)=='%'?parseFloat(c)/100*max:c}if(g.limit&&/^\d+$/.test(attr[key]))attr[key]=attr[key]<=0?0:Math.min(attr[key],max);if(!i&&g.queue){if(old!=attr[key])animate(g.onAfterFirst);delete attr[key]}});animate(g.onAfter);function animate(a){$elem.animate(attr,f,g.easing,a&&function(){a.call(this,targ,g)})}}).end()};h.max=function(a,b){var c=b=='x'?'Width':'Height',scroll='scroll'+c;if(!$(a).is('html,body'))return a[scroll]-$(a)[c.toLowerCase()]();var d='client'+c,html=a.ownerDocument.documentElement,body=a.ownerDocument.body;return Math.max(html[scroll],body[scroll])-Math.min(html[d],body[d])};function both(a){return typeof a=='object'?a:{top:a,left:a}}})(jQuery);
  ;
  /*!
  * Parsley.js
  * Version 2.7.0 - built Wed, Mar 1st 2017, 3:53 pm
  * http://parsleyjs.org
  * Guillaume Potier - <guillaume@wisembly.com>
  * Marc-Andre Lafortune - <petroselinum@marc-andre.ca>
  * MIT Licensed
  */
  function _toConsumableArray(e){if(Array.isArray(e)){for(var t=0,i=Array(e.length);t<e.length;t++)i[t]=e[t];return i}return Array.from(e)}var _slice=Array.prototype.slice,_slicedToArray=function(){function e(e,t){var i=[],n=!0,r=!1,s=void 0;try{for(var a,o=e[Symbol.iterator]();!(n=(a=o.next()).done)&&(i.push(a.value),!t||i.length!==t);n=!0);}catch(l){r=!0,s=l}finally{try{!n&&o["return"]&&o["return"]()}finally{if(r)throw s}}return i}return function(t,i){if(Array.isArray(t))return t;if(Symbol.iterator in Object(t))return e(t,i);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}();!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t(require("jquery")):"function"==typeof define&&define.amd?define(["jquery"],t):e.parsley=t(e.jQuery)}(this,function(e){"use strict";function t(e,t){return e.parsleyAdaptedCallback||(e.parsleyAdaptedCallback=function(){var i=Array.prototype.slice.call(arguments,0);i.unshift(this),e.apply(t||D,i)}),e.parsleyAdaptedCallback}function i(e){return 0===e.lastIndexOf(I,0)?e.substr(I.length):e}/**
     * inputevent - Alleviate browser bugs for input events
     * https://github.com/marcandre/inputevent
     * @version v0.0.3 - (built Thu, Apr 14th 2016, 5:58 pm)
     * @author Marc-Andre Lafortune <github@marc-andre.ca>
     * @license MIT
     */
  function n(){var t=this,i=window||global;e.extend(this,{isNativeEvent:function(e){return e.originalEvent&&e.originalEvent.isTrusted!==!1},fakeInputEvent:function(i){t.isNativeEvent(i)&&e(i.target).trigger("input")},misbehaves:function(i){t.isNativeEvent(i)&&(t.behavesOk(i),e(document).on("change.inputevent",i.data.selector,t.fakeInputEvent),t.fakeInputEvent(i))},behavesOk:function(i){t.isNativeEvent(i)&&e(document).off("input.inputevent",i.data.selector,t.behavesOk).off("change.inputevent",i.data.selector,t.misbehaves)},install:function(){if(!i.inputEventPatched){i.inputEventPatched="0.0.3";for(var n=["select",'input[type="checkbox"]','input[type="radio"]','input[type="file"]'],r=0;r<n.length;r++){var s=n[r];e(document).on("input.inputevent",s,{selector:s},t.behavesOk).on("change.inputevent",s,{selector:s},t.misbehaves)}}},uninstall:function(){delete i.inputEventPatched,e(document).off(".inputevent")}})}var r=1,s={},a={attr:function(e,t,i){var n,r,s,a=new RegExp("^"+t,"i");if("undefined"==typeof i)i={};else for(n in i)i.hasOwnProperty(n)&&delete i[n];if("undefined"==typeof e||"undefined"==typeof e[0])return i;for(s=e[0].attributes,n=s.length;n--;)r=s[n],r&&r.specified&&a.test(r.name)&&(i[this.camelize(r.name.slice(t.length))]=this.deserializeValue(r.value));return i},checkAttr:function(e,t,i){return e.is("["+t+i+"]")},setAttr:function(e,t,i,n){e[0].setAttribute(this.dasherize(t+i),String(n))},generateID:function(){return""+r++},deserializeValue:function(t){var i;try{return t?"true"==t||"false"!=t&&("null"==t?null:isNaN(i=Number(t))?/^[\[\{]/.test(t)?e.parseJSON(t):t:i):t}catch(n){return t}},camelize:function(e){return e.replace(/-+(.)?/g,function(e,t){return t?t.toUpperCase():""})},dasherize:function(e){return e.replace(/::/g,"/").replace(/([A-Z]+)([A-Z][a-z])/g,"$1_$2").replace(/([a-z\d])([A-Z])/g,"$1_$2").replace(/_/g,"-").toLowerCase()},warn:function(){var e;window.console&&"function"==typeof window.console.warn&&(e=window.console).warn.apply(e,arguments)},warnOnce:function(e){s[e]||(s[e]=!0,this.warn.apply(this,arguments))},_resetWarnings:function(){s={}},trimString:function(e){return e.replace(/^\s+|\s+$/g,"")},parse:{date:function z(e){var t=e.match(/^(\d{4,})-(\d\d)-(\d\d)$/);if(!t)return null;var i=t.map(function(e){return parseInt(e,10)}),n=_slicedToArray(i,4),r=(n[0],n[1]),s=n[2],a=n[3],z=new Date(r,s-1,a);return z.getFullYear()!==r||z.getMonth()+1!==s||z.getDate()!==a?null:z},string:function(e){return e},integer:function(e){return isNaN(e)?null:parseInt(e,10)},number:function(e){if(isNaN(e))throw null;return parseFloat(e)},"boolean":function(e){return!/^\s*false\s*$/i.test(e)},object:function(e){return a.deserializeValue(e)},regexp:function(e){var t="";return/^\/.*\/(?:[gimy]*)$/.test(e)?(t=e.replace(/.*\/([gimy]*)$/,"$1"),e=e.replace(new RegExp("^/(.*?)/"+t+"$"),"$1")):e="^"+e+"$",new RegExp(e,t)}},parseRequirement:function(e,t){var i=this.parse[e||"string"];if(!i)throw'Unknown requirement specification: "'+e+'"';var n=i(t);if(null===n)throw"Requirement is not a "+e+': "'+t+'"';return n},namespaceEvents:function(t,i){return t=this.trimString(t||"").split(/\s+/),t[0]?e.map(t,function(e){return e+"."+i}).join(" "):""},difference:function(t,i){var n=[];return e.each(t,function(e,t){i.indexOf(t)==-1&&n.push(t)}),n},all:function(t){return e.when.apply(e,_toConsumableArray(t).concat([42,42]))},objectCreate:Object.create||function(){var e=function(){};return function(t){if(arguments.length>1)throw Error("Second argument not supported");if("object"!=typeof t)throw TypeError("Argument must be an object");e.prototype=t;var i=new e;return e.prototype=null,i}}(),_SubmitSelector:'input[type="submit"], button:submit'},o=a,l={namespace:"data-parsley-",inputs:"input, textarea, select",excluded:"input[type=button], input[type=submit], input[type=reset], input[type=hidden]",priorityEnabled:!0,multiple:null,group:null,uiEnabled:!0,validationThreshold:3,focus:"first",trigger:!1,triggerAfterFailure:"input",errorClass:"parsley-error",successClass:"parsley-success",classHandler:function(e){},errorsContainer:function(e){},errorsWrapper:'<ul class="parsley-errors-list"></ul>',errorTemplate:"<li></li>"},u=function(){this.__id__=o.generateID()};u.prototype={asyncSupport:!0,_pipeAccordingToValidationResult:function(){var t=this,i=function(){var i=e.Deferred();return!0!==t.validationResult&&i.reject(),i.resolve().promise()};return[i,i]},actualizeOptions:function(){return o.attr(this.$element,this.options.namespace,this.domOptions),this.parent&&this.parent.actualizeOptions&&this.parent.actualizeOptions(),this},_resetOptions:function(e){this.domOptions=o.objectCreate(this.parent.options),this.options=o.objectCreate(this.domOptions);for(var t in e)e.hasOwnProperty(t)&&(this.options[t]=e[t]);this.actualizeOptions()},_listeners:null,on:function(e,t){this._listeners=this._listeners||{};var i=this._listeners[e]=this._listeners[e]||[];return i.push(t),this},subscribe:function(t,i){e.listenTo(this,t.toLowerCase(),i)},off:function(e,t){var i=this._listeners&&this._listeners[e];if(i)if(t)for(var n=i.length;n--;)i[n]===t&&i.splice(n,1);else delete this._listeners[e];return this},unsubscribe:function(t,i){e.unsubscribeTo(this,t.toLowerCase())},trigger:function(e,t,i){t=t||this;var n,r=this._listeners&&this._listeners[e];if(r)for(var s=r.length;s--;)if(n=r[s].call(t,t,i),n===!1)return n;return!this.parent||this.parent.trigger(e,t,i)},asyncIsValid:function(e,t){return o.warnOnce("asyncIsValid is deprecated; please use whenValid instead"),this.whenValid({group:e,force:t})},_findRelated:function(){return this.options.multiple?this.parent.$element.find("["+this.options.namespace+'multiple="'+this.options.multiple+'"]'):this.$element}};var d=function(e,t){var i=e.match(/^\s*\[(.*)\]\s*$/);if(!i)throw'Requirement is not an array: "'+e+'"';var n=i[1].split(",").map(o.trimString);if(n.length!==t)throw"Requirement has "+n.length+" values when "+t+" are needed";return n},h=function(e,t,i){var n=null,r={};for(var s in e)if(s){var a=i(s);"string"==typeof a&&(a=o.parseRequirement(e[s],a)),r[s]=a}else n=o.parseRequirement(e[s],t);return[n,r]},p=function(t){e.extend(!0,this,t)};p.prototype={validate:function(t,i){if(this.fn)return arguments.length>3&&(i=[].slice.call(arguments,1,-1)),this.fn(t,i);if(e.isArray(t)){if(!this.validateMultiple)throw"Validator `"+this.name+"` does not handle multiple values";return this.validateMultiple.apply(this,arguments)}var n=arguments[arguments.length-1];if(this.validateDate&&n._isDateInput())return arguments[0]=o.parse.date(arguments[0]),null!==arguments[0]&&this.validateDate.apply(this,arguments);if(this.validateNumber)return!isNaN(t)&&(arguments[0]=parseFloat(arguments[0]),this.validateNumber.apply(this,arguments));if(this.validateString)return this.validateString.apply(this,arguments);throw"Validator `"+this.name+"` only handles multiple values"},parseRequirements:function(t,i){if("string"!=typeof t)return e.isArray(t)?t:[t];var n=this.requirementType;if(e.isArray(n)){for(var r=d(t,n.length),s=0;s<r.length;s++)r[s]=o.parseRequirement(n[s],r[s]);return r}return e.isPlainObject(n)?h(n,t,i):[o.parseRequirement(n,t)]},requirementType:"string",priority:2};var c=function(e,t){this.__class__="ValidatorRegistry",this.locale="en",this.init(e||{},t||{})},f={email:/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i,number:/^-?(\d*\.)?\d+(e[-+]?\d+)?$/i,integer:/^-?\d+$/,digits:/^\d+$/,alphanum:/^\w+$/i,date:{test:function(e){return null!==o.parse.date(e)}},url:new RegExp("^(?:(?:https?|ftp)://)?(?:\\S+(?::\\S*)?@)?(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:/\\S*)?$","i")};f.range=f.number;var m=function(e){var t=(""+e).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);return t?Math.max(0,(t[1]?t[1].length:0)-(t[2]?+t[2]:0)):0},g=function(e,t){return t.map(o.parse[e])},v=function(e,t){return function(i){for(var n=arguments.length,r=Array(n>1?n-1:0),s=1;s<n;s++)r[s-1]=arguments[s];return r.pop(),t.apply(void 0,[i].concat(_toConsumableArray(g(e,r))))}},y=function(e){return{validateDate:v("date",e),validateNumber:v("number",e),requirementType:e.length<=2?"string":["string","string"],priority:30}};c.prototype={init:function(t,i){this.catalog=i,this.validators=e.extend({},this.validators);for(var n in t)this.addValidator(n,t[n].fn,t[n].priority);window.Parsley.trigger("parsley:validator:init")},setLocale:function(e){if("undefined"==typeof this.catalog[e])throw new Error(e+" is not available in the catalog");return this.locale=e,this},addCatalog:function(e,t,i){return"object"==typeof t&&(this.catalog[e]=t),!0===i?this.setLocale(e):this},addMessage:function(e,t,i){return"undefined"==typeof this.catalog[e]&&(this.catalog[e]={}),this.catalog[e][t]=i,this},addMessages:function(e,t){for(var i in t)this.addMessage(e,i,t[i]);return this},addValidator:function(e,t,i){if(this.validators[e])o.warn('Validator "'+e+'" is already defined.');else if(l.hasOwnProperty(e))return void o.warn('"'+e+'" is a restricted keyword and is not a valid validator name.');return this._setValidator.apply(this,arguments)},updateValidator:function(e,t,i){return this.validators[e]?this._setValidator.apply(this,arguments):(o.warn('Validator "'+e+'" is not already defined.'),this.addValidator.apply(this,arguments))},removeValidator:function(e){return this.validators[e]||o.warn('Validator "'+e+'" is not defined.'),delete this.validators[e],this},_setValidator:function(e,t,i){"object"!=typeof t&&(t={fn:t,priority:i}),t.validate||(t=new p(t)),this.validators[e]=t;for(var n in t.messages||{})this.addMessage(n,e,t.messages[n]);return this},getErrorMessage:function(e){var t;if("type"===e.name){var i=this.catalog[this.locale][e.name]||{};t=i[e.requirements]}else t=this.formatMessage(this.catalog[this.locale][e.name],e.requirements);return t||this.catalog[this.locale].defaultMessage||this.catalog.en.defaultMessage},formatMessage:function(e,t){if("object"==typeof t){for(var i in t)e=this.formatMessage(e,t[i]);return e}return"string"==typeof e?e.replace(/%s/i,t):""},validators:{notblank:{validateString:function(e){return/\S/.test(e)},priority:2},required:{validateMultiple:function(e){return e.length>0},validateString:function(e){return/\S/.test(e)},priority:512},type:{validateString:function(e,t){var i=arguments.length<=2||void 0===arguments[2]?{}:arguments[2],n=i.step,r=void 0===n?"any":n,s=i.base,a=void 0===s?0:s,o=f[t];if(!o)throw new Error("validator type `"+t+"` is not supported");if(!o.test(e))return!1;if("number"===t&&!/^any$/i.test(r||"")){var l=Number(e),u=Math.max(m(r),m(a));if(m(l)>u)return!1;var d=function(e){return Math.round(e*Math.pow(10,u))};if((d(l)-d(a))%d(r)!=0)return!1}return!0},requirementType:{"":"string",step:"string",base:"number"},priority:256},pattern:{validateString:function(e,t){return t.test(e)},requirementType:"regexp",priority:64},minlength:{validateString:function(e,t){return e.length>=t},requirementType:"integer",priority:30},maxlength:{validateString:function(e,t){return e.length<=t},requirementType:"integer",priority:30},length:{validateString:function(e,t,i){return e.length>=t&&e.length<=i},requirementType:["integer","integer"],priority:30},mincheck:{validateMultiple:function(e,t){return e.length>=t},requirementType:"integer",priority:30},maxcheck:{validateMultiple:function(e,t){return e.length<=t},requirementType:"integer",priority:30},check:{validateMultiple:function(e,t,i){return e.length>=t&&e.length<=i},requirementType:["integer","integer"],priority:30},min:y(function(e,t){return e>=t}),max:y(function(e,t){return e<=t}),range:y(function(e,t,i){return e>=t&&e<=i}),equalto:{validateString:function(t,i){var n=e(i);return n.length?t===n.val():t===i},priority:256}}};var _={},w=function S(e,t,i){for(var n=[],r=[],s=0;s<e.length;s++){for(var a=!1,o=0;o<t.length;o++)if(e[s].assert.name===t[o].assert.name){a=!0;break}a?r.push(e[s]):n.push(e[s])}return{kept:r,added:n,removed:i?[]:S(t,e,!0).added}};_.Form={_actualizeTriggers:function(){var e=this;this.$element.on("submit.Parsley",function(t){e.onSubmitValidate(t)}),this.$element.on("click.Parsley",o._SubmitSelector,function(t){e.onSubmitButton(t)}),!1!==this.options.uiEnabled&&this.$element.attr("novalidate","")},focus:function(){if(this._focusedField=null,!0===this.validationResult||"none"===this.options.focus)return null;for(var e=0;e<this.fields.length;e++){var t=this.fields[e];if(!0!==t.validationResult&&t.validationResult.length>0&&"undefined"==typeof t.options.noFocus&&(this._focusedField=t.$element,"first"===this.options.focus))break}return null===this._focusedField?null:this._focusedField.focus()},_destroyUI:function(){this.$element.off(".Parsley")}},_.Field={_reflowUI:function(){if(this._buildUI(),this._ui){var e=w(this.validationResult,this._ui.lastValidationResult);this._ui.lastValidationResult=this.validationResult,this._manageStatusClass(),this._manageErrorsMessages(e),this._actualizeTriggers(),!e.kept.length&&!e.added.length||this._failedOnce||(this._failedOnce=!0,this._actualizeTriggers())}},getErrorsMessages:function(){if(!0===this.validationResult)return[];for(var e=[],t=0;t<this.validationResult.length;t++)e.push(this.validationResult[t].errorMessage||this._getErrorMessage(this.validationResult[t].assert));return e},addError:function(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1],i=t.message,n=t.assert,r=t.updateClass,s=void 0===r||r;this._buildUI(),this._addError(e,{message:i,assert:n}),s&&this._errorClass()},updateError:function(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1],i=t.message,n=t.assert,r=t.updateClass,s=void 0===r||r;this._buildUI(),this._updateError(e,{message:i,assert:n}),s&&this._errorClass()},removeError:function(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1],i=t.updateClass,n=void 0===i||i;this._buildUI(),this._removeError(e),n&&this._manageStatusClass()},_manageStatusClass:function(){this.hasConstraints()&&this.needsValidation()&&!0===this.validationResult?this._successClass():this.validationResult.length>0?this._errorClass():this._resetClass()},_manageErrorsMessages:function(t){if("undefined"==typeof this.options.errorsMessagesDisabled){if("undefined"!=typeof this.options.errorMessage)return t.added.length||t.kept.length?(this._insertErrorWrapper(),0===this._ui.$errorsWrapper.find(".parsley-custom-error-message").length&&this._ui.$errorsWrapper.append(e(this.options.errorTemplate).addClass("parsley-custom-error-message")),this._ui.$errorsWrapper.addClass("filled").find(".parsley-custom-error-message").html(this.options.errorMessage)):this._ui.$errorsWrapper.removeClass("filled").find(".parsley-custom-error-message").remove();for(var i=0;i<t.removed.length;i++)this._removeError(t.removed[i].assert.name);for(i=0;i<t.added.length;i++)this._addError(t.added[i].assert.name,{message:t.added[i].errorMessage,assert:t.added[i].assert});for(i=0;i<t.kept.length;i++)this._updateError(t.kept[i].assert.name,{message:t.kept[i].errorMessage,assert:t.kept[i].assert})}},_addError:function(t,i){var n=i.message,r=i.assert;this._insertErrorWrapper(),this._ui.$errorsWrapper.addClass("filled").append(e(this.options.errorTemplate).addClass("parsley-"+t).html(n||this._getErrorMessage(r)))},_updateError:function(e,t){var i=t.message,n=t.assert;this._ui.$errorsWrapper.addClass("filled").find(".parsley-"+e).html(i||this._getErrorMessage(n))},_removeError:function(e){this._ui.$errorsWrapper.removeClass("filled").find(".parsley-"+e).remove()},_getErrorMessage:function(e){var t=e.name+"Message";return"undefined"!=typeof this.options[t]?window.Parsley.formatMessage(this.options[t],e.requirements):window.Parsley.getErrorMessage(e)},_buildUI:function(){if(!this._ui&&!1!==this.options.uiEnabled){var t={};this.$element.attr(this.options.namespace+"id",this.__id__),t.$errorClassHandler=this._manageClassHandler(),t.errorsWrapperId="parsley-id-"+(this.options.multiple?"multiple-"+this.options.multiple:this.__id__),t.$errorsWrapper=e(this.options.errorsWrapper).attr("id",t.errorsWrapperId),t.lastValidationResult=[],t.validationInformationVisible=!1,this._ui=t}},_manageClassHandler:function(){if("string"==typeof this.options.classHandler&&e(this.options.classHandler).length)return e(this.options.classHandler);var t=this.options.classHandler.call(this,this);return"undefined"!=typeof t&&t.length?t:this._inputHolder()},_inputHolder:function(){return!this.options.multiple||this.$element.is("select")?this.$element:this.$element.parent()},_insertErrorWrapper:function(){var t;if(0!==this._ui.$errorsWrapper.parent().length)return this._ui.$errorsWrapper.parent();if("string"==typeof this.options.errorsContainer){if(e(this.options.errorsContainer).length)return e(this.options.errorsContainer).append(this._ui.$errorsWrapper);o.warn("The errors container `"+this.options.errorsContainer+"` does not exist in DOM")}else"function"==typeof this.options.errorsContainer&&(t=this.options.errorsContainer.call(this,this));return"undefined"!=typeof t&&t.length?t.append(this._ui.$errorsWrapper):this._inputHolder().after(this._ui.$errorsWrapper)},_actualizeTriggers:function(){var e,t=this,i=this._findRelated();i.off(".Parsley"),this._failedOnce?i.on(o.namespaceEvents(this.options.triggerAfterFailure,"Parsley"),function(){t._validateIfNeeded()}):(e=o.namespaceEvents(this.options.trigger,"Parsley"))&&i.on(e,function(e){t._validateIfNeeded(e)})},_validateIfNeeded:function(e){var t=this;e&&/key|input/.test(e.type)&&(!this._ui||!this._ui.validationInformationVisible)&&this.getValue().length<=this.options.validationThreshold||(this.options.debounce?(window.clearTimeout(this._debounced),this._debounced=window.setTimeout(function(){return t.validate()},this.options.debounce)):this.validate())},_resetUI:function(){this._failedOnce=!1,this._actualizeTriggers(),"undefined"!=typeof this._ui&&(this._ui.$errorsWrapper.removeClass("filled").children().remove(),this._resetClass(),this._ui.lastValidationResult=[],this._ui.validationInformationVisible=!1)},_destroyUI:function(){this._resetUI(),"undefined"!=typeof this._ui&&this._ui.$errorsWrapper.remove(),delete this._ui},_successClass:function(){this._ui.validationInformationVisible=!0,this._ui.$errorClassHandler.removeClass(this.options.errorClass).addClass(this.options.successClass)},_errorClass:function(){this._ui.validationInformationVisible=!0,this._ui.$errorClassHandler.removeClass(this.options.successClass).addClass(this.options.errorClass)},_resetClass:function(){this._ui.$errorClassHandler.removeClass(this.options.successClass).removeClass(this.options.errorClass)}};var b=function(t,i,n){this.__class__="Form",this.$element=e(t),this.domOptions=i,this.options=n,this.parent=window.Parsley,this.fields=[],this.validationResult=null},F={pending:null,resolved:!0,rejected:!1};b.prototype={onSubmitValidate:function(e){var t=this;if(!0!==e.parsley){var i=this._$submitSource||this.$element.find(o._SubmitSelector).first();if(this._$submitSource=null,this.$element.find(".parsley-synthetic-submit-button").prop("disabled",!0),!i.is("[formnovalidate]")){var n=this.whenValidate({event:e});"resolved"===n.state()&&!1!==this._trigger("submit")||(e.stopImmediatePropagation(),e.preventDefault(),"pending"===n.state()&&n.done(function(){t._submit(i)}))}}},onSubmitButton:function(t){this._$submitSource=e(t.currentTarget)},_submit:function(t){if(!1!==this._trigger("submit")){if(t){var i=this.$element.find(".parsley-synthetic-submit-button").prop("disabled",!1);0===i.length&&(i=e('<input class="parsley-synthetic-submit-button" type="hidden">').appendTo(this.$element)),i.attr({name:t.attr("name"),value:t.attr("value")})}this.$element.trigger(e.extend(e.Event("submit"),{parsley:!0}))}},validate:function(t){if(arguments.length>=1&&!e.isPlainObject(t)){o.warnOnce("Calling validate on a parsley form without passing arguments as an object is deprecated.");var i=_slice.call(arguments),n=i[0],r=i[1],s=i[2];t={group:n,force:r,event:s}}return F[this.whenValidate(t).state()]},whenValidate:function(){var t,i=this,n=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],r=n.group,s=n.force,a=n.event;this.submitEvent=a,a&&(this.submitEvent=e.extend({},a,{preventDefault:function(){o.warnOnce("Using `this.submitEvent.preventDefault()` is deprecated; instead, call `this.validationResult = false`"),i.validationResult=!1}})),this.validationResult=!0,this._trigger("validate"),this._refreshFields();var l=this._withoutReactualizingFormOptions(function(){return e.map(i.fields,function(e){return e.whenValidate({force:s,group:r})})});return(t=o.all(l).done(function(){i._trigger("success")}).fail(function(){i.validationResult=!1,i.focus(),i._trigger("error")}).always(function(){i._trigger("validated")})).pipe.apply(t,_toConsumableArray(this._pipeAccordingToValidationResult()))},isValid:function(t){if(arguments.length>=1&&!e.isPlainObject(t)){o.warnOnce("Calling isValid on a parsley form without passing arguments as an object is deprecated.");var i=_slice.call(arguments),n=i[0],r=i[1];t={group:n,force:r}}return F[this.whenValid(t).state()]},whenValid:function(){var t=this,i=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],n=i.group,r=i.force;this._refreshFields();var s=this._withoutReactualizingFormOptions(function(){return e.map(t.fields,function(e){return e.whenValid({group:n,force:r})})});return o.all(s)},reset:function(){for(var e=0;e<this.fields.length;e++)this.fields[e].reset();this._trigger("reset")},destroy:function(){this._destroyUI();for(var e=0;e<this.fields.length;e++)this.fields[e].destroy();this.$element.removeData("Parsley"),this._trigger("destroy")},_refreshFields:function(){return this.actualizeOptions()._bindFields()},_bindFields:function(){var t=this,i=this.fields;return this.fields=[],this.fieldsMappedById={},this._withoutReactualizingFormOptions(function(){t.$element.find(t.options.inputs).not(t.options.excluded).each(function(e,i){var n=new window.Parsley.Factory(i,{},t);if(("Field"===n.__class__||"FieldMultiple"===n.__class__)&&!0!==n.options.excluded){var r=n.__class__+"-"+n.__id__;"undefined"==typeof t.fieldsMappedById[r]&&(t.fieldsMappedById[r]=n,t.fields.push(n))}}),e.each(o.difference(i,t.fields),function(e,t){t.reset()})}),this},_withoutReactualizingFormOptions:function(e){var t=this.actualizeOptions;this.actualizeOptions=function(){return this};var i=e();return this.actualizeOptions=t,i},_trigger:function(e){return this.trigger("form:"+e)}};var C=function(t,i,n,r,s){var a=window.Parsley._validatorRegistry.validators[i],o=new p(a);e.extend(this,{validator:o,name:i,requirements:n,priority:r||t.options[i+"Priority"]||o.priority,isDomConstraint:!0===s}),this._parseRequirements(t.options)},$=function(e){var t=e[0].toUpperCase();return t+e.slice(1)};C.prototype={validate:function(e,t){var i;return(i=this.validator).validate.apply(i,[e].concat(_toConsumableArray(this.requirementList),[t]))},_parseRequirements:function(e){var t=this;this.requirementList=this.validator.parseRequirements(this.requirements,function(i){return e[t.name+$(i)]})}};var x=function(t,i,n,r){this.__class__="Field",this.$element=e(t),"undefined"!=typeof r&&(this.parent=r),this.options=n,this.domOptions=i,this.constraints=[],this.constraintsByName={},this.validationResult=!0,this._bindConstraints()},E={pending:null,resolved:!0,rejected:!1};x.prototype={validate:function(t){arguments.length>=1&&!e.isPlainObject(t)&&(o.warnOnce("Calling validate on a parsley field without passing arguments as an object is deprecated."),t={options:t});var i=this.whenValidate(t);if(!i)return!0;switch(i.state()){case"pending":return null;case"resolved":return!0;case"rejected":return this.validationResult}},whenValidate:function(){var e,t=this,i=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],n=i.force,r=i.group;if(this.refreshConstraints(),!r||this._isInGroup(r))return this.value=this.getValue(),this._trigger("validate"),(e=this.whenValid({force:n,value:this.value,_refreshed:!0}).always(function(){t._reflowUI()}).done(function(){t._trigger("success")}).fail(function(){t._trigger("error")}).always(function(){t._trigger("validated")})).pipe.apply(e,_toConsumableArray(this._pipeAccordingToValidationResult()))},hasConstraints:function(){return 0!==this.constraints.length},needsValidation:function(e){return"undefined"==typeof e&&(e=this.getValue()),!(!e.length&&!this._isRequired()&&"undefined"==typeof this.options.validateIfEmpty)},_isInGroup:function(t){return e.isArray(this.options.group)?-1!==e.inArray(t,this.options.group):this.options.group===t},isValid:function(t){if(arguments.length>=1&&!e.isPlainObject(t)){o.warnOnce("Calling isValid on a parsley field without passing arguments as an object is deprecated.");var i=_slice.call(arguments),n=i[0],r=i[1];t={force:n,value:r}}var s=this.whenValid(t);return!s||E[s.state()]},whenValid:function(){var t=this,i=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],n=i.force,r=void 0!==n&&n,s=i.value,a=i.group,l=i._refreshed;if(l||this.refreshConstraints(),!a||this._isInGroup(a)){if(this.validationResult=!0,!this.hasConstraints())return e.when();if("undefined"!=typeof s&&null!==s||(s=this.getValue()),!this.needsValidation(s)&&!0!==r)return e.when();var u=this._getGroupedConstraints(),d=[];return e.each(u,function(i,n){var r=o.all(e.map(n,function(e){return t._validateConstraint(s,e)}));if(d.push(r),"rejected"===r.state())return!1}),o.all(d)}},_validateConstraint:function(t,i){var n=this,r=i.validate(t,this);return!1===r&&(r=e.Deferred().reject()),o.all([r]).fail(function(e){n.validationResult instanceof Array||(n.validationResult=[]),n.validationResult.push({assert:i,errorMessage:"string"==typeof e&&e})})},getValue:function(){var e;return e="function"==typeof this.options.value?this.options.value(this):"undefined"!=typeof this.options.value?this.options.value:this.$element.val(),"undefined"==typeof e||null===e?"":this._handleWhitespace(e)},reset:function(){return this._resetUI(),this._trigger("reset")},destroy:function(){this._destroyUI(),this.$element.removeData("Parsley"),this.$element.removeData("FieldMultiple"),this._trigger("destroy")},refreshConstraints:function(){return this.actualizeOptions()._bindConstraints()},addConstraint:function(e,t,i,n){if(window.Parsley._validatorRegistry.validators[e]){var r=new C(this,e,t,i,n);"undefined"!==this.constraintsByName[r.name]&&this.removeConstraint(r.name),this.constraints.push(r),this.constraintsByName[r.name]=r}return this},removeConstraint:function(e){for(var t=0;t<this.constraints.length;t++)if(e===this.constraints[t].name){this.constraints.splice(t,1);break}return delete this.constraintsByName[e],this},updateConstraint:function(e,t,i){return this.removeConstraint(e).addConstraint(e,t,i)},_bindConstraints:function(){for(var e=[],t={},i=0;i<this.constraints.length;i++)!1===this.constraints[i].isDomConstraint&&(e.push(this.constraints[i]),t[this.constraints[i].name]=this.constraints[i]);this.constraints=e,this.constraintsByName=t;for(var n in this.options)this.addConstraint(n,this.options[n],void 0,!0);return this._bindHtml5Constraints()},_bindHtml5Constraints:function(){this.$element.attr("required")&&this.addConstraint("required",!0,void 0,!0),"string"==typeof this.$element.attr("pattern")&&this.addConstraint("pattern",this.$element.attr("pattern"),void 0,!0),"undefined"!=typeof this.$element.attr("min")&&"undefined"!=typeof this.$element.attr("max")?this.addConstraint("range",[this.$element.attr("min"),this.$element.attr("max")],void 0,!0):"undefined"!=typeof this.$element.attr("min")?this.addConstraint("min",this.$element.attr("min"),void 0,!0):"undefined"!=typeof this.$element.attr("max")&&this.addConstraint("max",this.$element.attr("max"),void 0,!0),"undefined"!=typeof this.$element.attr("minlength")&&"undefined"!=typeof this.$element.attr("maxlength")?this.addConstraint("length",[this.$element.attr("minlength"),this.$element.attr("maxlength")],void 0,!0):"undefined"!=typeof this.$element.attr("minlength")?this.addConstraint("minlength",this.$element.attr("minlength"),void 0,!0):"undefined"!=typeof this.$element.attr("maxlength")&&this.addConstraint("maxlength",this.$element.attr("maxlength"),void 0,!0);var e=this.$element.attr("type");return"undefined"==typeof e?this:"number"===e?this.addConstraint("type",["number",{step:this.$element.attr("step")||"1",base:this.$element.attr("min")||this.$element.attr("value")}],void 0,!0):/^(email|url|range|date)$/i.test(e)?this.addConstraint("type",e,void 0,!0):this},_isRequired:function(){return"undefined"!=typeof this.constraintsByName.required&&!1!==this.constraintsByName.required.requirements},_trigger:function(e){return this.trigger("field:"+e)},_handleWhitespace:function(e){return!0===this.options.trimValue&&o.warnOnce('data-parsley-trim-value="true" is deprecated, please use data-parsley-whitespace="trim"'),"squish"===this.options.whitespace&&(e=e.replace(/\s{2,}/g," ")),"trim"!==this.options.whitespace&&"squish"!==this.options.whitespace&&!0!==this.options.trimValue||(e=o.trimString(e)),e},_isDateInput:function(){var e=this.constraintsByName.type;return e&&"date"===e.requirements},_getGroupedConstraints:function(){if(!1===this.options.priorityEnabled)return[this.constraints];for(var e=[],t={},i=0;i<this.constraints.length;i++){var n=this.constraints[i].priority;t[n]||e.push(t[n]=[]),t[n].push(this.constraints[i])}return e.sort(function(e,t){return t[0].priority-e[0].priority}),e}};var V=x,P=function(){this.__class__="FieldMultiple"};P.prototype={addElement:function(e){return this.$elements.push(e),this},refreshConstraints:function(){var t;if(this.constraints=[],this.$element.is("select"))return this.actualizeOptions()._bindConstraints(),this;for(var i=0;i<this.$elements.length;i++)if(e("html").has(this.$elements[i]).length){t=this.$elements[i].data("FieldMultiple").refreshConstraints().constraints;for(var n=0;n<t.length;n++)this.addConstraint(t[n].name,t[n].requirements,t[n].priority,t[n].isDomConstraint)}else this.$elements.splice(i,1);return this},getValue:function(){if("function"==typeof this.options.value)return this.options.value(this);if("undefined"!=typeof this.options.value)return this.options.value;if(this.$element.is("input[type=radio]"))return this._findRelated().filter(":checked").val()||"";if(this.$element.is("input[type=checkbox]")){var t=[];return this._findRelated().filter(":checked").each(function(){t.push(e(this).val())}),t}return this.$element.is("select")&&null===this.$element.val()?[]:this.$element.val()},_init:function(){return this.$elements=[this.$element],this}};var A=function(t,i,n){this.$element=e(t);var r=this.$element.data("Parsley");if(r)return"undefined"!=typeof n&&r.parent===window.Parsley&&(r.parent=n,r._resetOptions(r.options)),"object"==typeof i&&e.extend(r.options,i),r;if(!this.$element.length)throw new Error("You must bind Parsley on an existing element.");if("undefined"!=typeof n&&"Form"!==n.__class__)throw new Error("Parent instance must be a Form instance");return this.parent=n||window.Parsley,
  this.init(i)};A.prototype={init:function(e){return this.__class__="Parsley",this.__version__="2.7.0",this.__id__=o.generateID(),this._resetOptions(e),this.$element.is("form")||o.checkAttr(this.$element,this.options.namespace,"validate")&&!this.$element.is(this.options.inputs)?this.bind("parsleyForm"):this.isMultiple()?this.handleMultiple():this.bind("parsleyField")},isMultiple:function(){return this.$element.is("input[type=radio], input[type=checkbox]")||this.$element.is("select")&&"undefined"!=typeof this.$element.attr("multiple")},handleMultiple:function(){var t,i,n=this;if(this.options.multiple||("undefined"!=typeof this.$element.attr("name")&&this.$element.attr("name").length?this.options.multiple=t=this.$element.attr("name"):"undefined"!=typeof this.$element.attr("id")&&this.$element.attr("id").length&&(this.options.multiple=this.$element.attr("id"))),this.$element.is("select")&&"undefined"!=typeof this.$element.attr("multiple"))return this.options.multiple=this.options.multiple||this.__id__,this.bind("parsleyFieldMultiple");if(!this.options.multiple)return o.warn("To be bound by Parsley, a radio, a checkbox and a multiple select input must have either a name or a multiple option.",this.$element),this;this.options.multiple=this.options.multiple.replace(/(:|\.|\[|\]|\{|\}|\$)/g,""),"undefined"!=typeof t&&e('input[name="'+t+'"]').each(function(t,i){e(i).is("input[type=radio], input[type=checkbox]")&&e(i).attr(n.options.namespace+"multiple",n.options.multiple)});for(var r=this._findRelated(),s=0;s<r.length;s++)if(i=e(r.get(s)).data("Parsley"),"undefined"!=typeof i){this.$element.data("FieldMultiple")||i.addElement(this.$element);break}return this.bind("parsleyField",!0),i||this.bind("parsleyFieldMultiple")},bind:function(t,i){var n;switch(t){case"parsleyForm":n=e.extend(new b(this.$element,this.domOptions,this.options),new u,window.ParsleyExtend)._bindFields();break;case"parsleyField":n=e.extend(new V(this.$element,this.domOptions,this.options,this.parent),new u,window.ParsleyExtend);break;case"parsleyFieldMultiple":n=e.extend(new V(this.$element,this.domOptions,this.options,this.parent),new P,new u,window.ParsleyExtend)._init();break;default:throw new Error(t+"is not a supported Parsley type")}return this.options.multiple&&o.setAttr(this.$element,this.options.namespace,"multiple",this.options.multiple),"undefined"!=typeof i?(this.$element.data("FieldMultiple",n),n):(this.$element.data("Parsley",n),n._actualizeTriggers(),n._trigger("init"),n)}};var M=e.fn.jquery.split(".");if(parseInt(M[0])<=1&&parseInt(M[1])<8)throw"The loaded version of jQuery is too old. Please upgrade to 1.8.x or better.";M.forEach||o.warn("Parsley requires ES5 to run properly. Please include https://github.com/es-shims/es5-shim");var O=e.extend(new u,{$element:e(document),actualizeOptions:null,_resetOptions:null,Factory:A,version:"2.7.0"});e.extend(V.prototype,_.Field,u.prototype),e.extend(b.prototype,_.Form,u.prototype),e.extend(A.prototype,u.prototype),e.fn.parsley=e.fn.psly=function(t){if(this.length>1){var i=[];return this.each(function(){i.push(e(this).parsley(t))}),i}return e(this).length?new A(this,t):void o.warn("You must bind Parsley on an existing element.")},"undefined"==typeof window.ParsleyExtend&&(window.ParsleyExtend={}),O.options=e.extend(o.objectCreate(l),window.ParsleyConfig),window.ParsleyConfig=O.options,window.Parsley=window.psly=O,O.Utils=o,window.ParsleyUtils={},e.each(o,function(e,t){"function"==typeof t&&(window.ParsleyUtils[e]=function(){return o.warnOnce("Accessing `window.ParsleyUtils` is deprecated. Use `window.Parsley.Utils` instead."),o[e].apply(o,arguments)})});var R=window.Parsley._validatorRegistry=new c(window.ParsleyConfig.validators,window.ParsleyConfig.i18n);window.ParsleyValidator={},e.each("setLocale addCatalog addMessage addMessages getErrorMessage formatMessage addValidator updateValidator removeValidator".split(" "),function(t,i){window.Parsley[i]=e.proxy(R,i),window.ParsleyValidator[i]=function(){var e;return o.warnOnce("Accessing the method '"+i+"' through Validator is deprecated. Simply call 'window.Parsley."+i+"(...)'"),(e=window.Parsley)[i].apply(e,arguments)}}),window.Parsley.UI=_,window.ParsleyUI={removeError:function(e,t,i){var n=!0!==i;return o.warnOnce("Accessing UI is deprecated. Call 'removeError' on the instance directly. Please comment in issue 1073 as to your need to call this method."),e.removeError(t,{updateClass:n})},getErrorsMessages:function(e){return o.warnOnce("Accessing UI is deprecated. Call 'getErrorsMessages' on the instance directly."),e.getErrorsMessages()}},e.each("addError updateError".split(" "),function(e,t){window.ParsleyUI[t]=function(e,i,n,r,s){var a=!0!==s;return o.warnOnce("Accessing UI is deprecated. Call '"+t+"' on the instance directly. Please comment in issue 1073 as to your need to call this method."),e[t](i,{message:n,assert:r,updateClass:a})}}),!1!==window.ParsleyConfig.autoBind&&e(function(){e("[data-parsley-validate]").length&&e("[data-parsley-validate]").parsley()});var D=e({}),T=function(){o.warnOnce("Parsley's pubsub module is deprecated; use the 'on' and 'off' methods on parsley instances or window.Parsley")},I="parsley:";e.listen=function(e,n){var r;if(T(),"object"==typeof arguments[1]&&"function"==typeof arguments[2]&&(r=arguments[1],n=arguments[2]),"function"!=typeof n)throw new Error("Wrong parameters");window.Parsley.on(i(e),t(n,r))},e.listenTo=function(e,n,r){if(T(),!(e instanceof V||e instanceof b))throw new Error("Must give Parsley instance");if("string"!=typeof n||"function"!=typeof r)throw new Error("Wrong parameters");e.on(i(n),t(r))},e.unsubscribe=function(e,t){if(T(),"string"!=typeof e||"function"!=typeof t)throw new Error("Wrong arguments");window.Parsley.off(i(e),t.parsleyAdaptedCallback)},e.unsubscribeTo=function(e,t){if(T(),!(e instanceof V||e instanceof b))throw new Error("Must give Parsley instance");e.off(i(t))},e.unsubscribeAll=function(t){T(),window.Parsley.off(i(t)),e("form,input,textarea,select").each(function(){var n=e(this).data("Parsley");n&&n.off(i(t))})},e.emit=function(e,t){var n;T();var r=t instanceof V||t instanceof b,s=Array.prototype.slice.call(arguments,r?2:1);s.unshift(i(e)),r||(t=window.Parsley),(n=t).trigger.apply(n,_toConsumableArray(s))};e.extend(!0,O,{asyncValidators:{"default":{fn:function(e){return e.status>=200&&e.status<300},url:!1},reverse:{fn:function(e){return e.status<200||e.status>=300},url:!1}},addAsyncValidator:function(e,t,i,n){return O.asyncValidators[e]={fn:t,url:i||!1,options:n||{}},this}}),O.addValidator("remote",{requirementType:{"":"string",validator:"string",reverse:"boolean",options:"object"},validateString:function(t,i,n,r){var s,a,o={},l=n.validator||(!0===n.reverse?"reverse":"default");if("undefined"==typeof O.asyncValidators[l])throw new Error("Calling an undefined async validator: `"+l+"`");i=O.asyncValidators[l].url||i,i.indexOf("{value}")>-1?i=i.replace("{value}",encodeURIComponent(t)):o[r.$element.attr("name")||r.$element.attr("id")]=t;var u=e.extend(!0,n.options||{},O.asyncValidators[l].options);s=e.extend(!0,{},{url:i,data:o,type:"GET"},u),r.trigger("field:ajaxoptions",r,s),a=e.param(s),"undefined"==typeof O._remoteCache&&(O._remoteCache={});var d=O._remoteCache[a]=O._remoteCache[a]||e.ajax(s),h=function(){var t=O.asyncValidators[l].fn.call(r,d,i,n);return t||(t=e.Deferred().reject()),e.when(t)};return d.then(h,h)},priority:-1}),O.on("form:submit",function(){O._remoteCache={}}),window.ParsleyExtend.addAsyncValidator=function(){return Utils.warnOnce("Accessing the method `addAsyncValidator` through an instance is deprecated. Simply call `Parsley.addAsyncValidator(...)`"),O.addAsyncValidator.apply(O,arguments)},O.addMessages("en",{defaultMessage:"This value seems to be invalid.",type:{email:"This value should be a valid email.",url:"This value should be a valid url.",number:"This value should be a valid number.",integer:"This value should be a valid integer.",digits:"This value should be digits.",alphanum:"This value should be alphanumeric."},notblank:"This value should not be blank.",required:"This value is required.",pattern:"This value seems to be invalid.",min:"This value should be greater than or equal to %s.",max:"This value should be lower than or equal to %s.",range:"This value should be between %s and %s.",minlength:"This value is too short. It should have %s characters or more.",maxlength:"This value is too long. It should have %s characters or fewer.",length:"This value length is invalid. It should be between %s and %s characters long.",mincheck:"You must select at least %s choices.",maxcheck:"You must select %s choices or fewer.",check:"You must select between %s and %s choices.",equalto:"This value should be the same."}),O.setLocale("en");var q=new n;q.install();var k=O;return k});
  
  /*!
  Waypoints - 4.0.0
  Copyright © 2011-2015 Caleb Troughton
  Licensed under the MIT license.
  https://github.com/imakewebthings/waypoints/blob/master/licenses.txt
  */
  !function(){"use strict";function t(o){if(!o)throw new Error("No options passed to Waypoint constructor");if(!o.element)throw new Error("No element option passed to Waypoint constructor");if(!o.handler)throw new Error("No handler option passed to Waypoint constructor");this.key="waypoint-"+e,this.options=t.Adapter.extend({},t.defaults,o),this.element=this.options.element,this.adapter=new t.Adapter(this.element),this.callback=o.handler,this.axis=this.options.horizontal?"horizontal":"vertical",this.enabled=this.options.enabled,this.triggerPoint=null,this.group=t.Group.findOrCreate({name:this.options.group,axis:this.axis}),this.context=t.Context.findOrCreateByElement(this.options.context),t.offsetAliases[this.options.offset]&&(this.options.offset=t.offsetAliases[this.options.offset]),this.group.add(this),this.context.add(this),i[this.key]=this,e+=1}var e=0,i={};t.prototype.queueTrigger=function(t){this.group.queueTrigger(this,t)},t.prototype.trigger=function(t){this.enabled&&this.callback&&this.callback.apply(this,t)},t.prototype.destroy=function(){this.context.remove(this),this.group.remove(this),delete i[this.key]},t.prototype.disable=function(){return this.enabled=!1,this},t.prototype.enable=function(){return this.context.refresh(),this.enabled=!0,this},t.prototype.next=function(){return this.group.next(this)},t.prototype.previous=function(){return this.group.previous(this)},t.invokeAll=function(t){var e=[];for(var o in i)e.push(i[o]);for(var n=0,r=e.length;r>n;n++)e[n][t]()},t.destroyAll=function(){t.invokeAll("destroy")},t.disableAll=function(){t.invokeAll("disable")},t.enableAll=function(){t.invokeAll("enable")},t.refreshAll=function(){t.Context.refreshAll()},t.viewportHeight=function(){return window.innerHeight||document.documentElement.clientHeight},t.viewportWidth=function(){return document.documentElement.clientWidth},t.adapters=[],t.defaults={context:window,continuous:!0,enabled:!0,group:"default",horizontal:!1,offset:0},t.offsetAliases={"bottom-in-view":function(){return this.context.innerHeight()-this.adapter.outerHeight()},"right-in-view":function(){return this.context.innerWidth()-this.adapter.outerWidth()}},window.Waypoint=t}(),function(){"use strict";function t(t){window.setTimeout(t,1e3/60)}function e(t){this.element=t,this.Adapter=n.Adapter,this.adapter=new this.Adapter(t),this.key="waypoint-context-"+i,this.didScroll=!1,this.didResize=!1,this.oldScroll={x:this.adapter.scrollLeft(),y:this.adapter.scrollTop()},this.waypoints={vertical:{},horizontal:{}},t.waypointContextKey=this.key,o[t.waypointContextKey]=this,i+=1,this.createThrottledScrollHandler(),this.createThrottledResizeHandler()}var i=0,o={},n=window.Waypoint,r=window.onload;e.prototype.add=function(t){var e=t.options.horizontal?"horizontal":"vertical";this.waypoints[e][t.key]=t,this.refresh()},e.prototype.checkEmpty=function(){var t=this.Adapter.isEmptyObject(this.waypoints.horizontal),e=this.Adapter.isEmptyObject(this.waypoints.vertical);t&&e&&(this.adapter.off(".waypoints"),delete o[this.key])},e.prototype.createThrottledResizeHandler=function(){function t(){e.handleResize(),e.didResize=!1}var e=this;this.adapter.on("resize.waypoints",function(){e.didResize||(e.didResize=!0,n.requestAnimationFrame(t))})},e.prototype.createThrottledScrollHandler=function(){function t(){e.handleScroll(),e.didScroll=!1}var e=this;this.adapter.on("scroll.waypoints",function(){(!e.didScroll||n.isTouch)&&(e.didScroll=!0,n.requestAnimationFrame(t))})},e.prototype.handleResize=function(){n.Context.refreshAll()},e.prototype.handleScroll=function(){var t={},e={horizontal:{newScroll:this.adapter.scrollLeft(),oldScroll:this.oldScroll.x,forward:"right",backward:"left"},vertical:{newScroll:this.adapter.scrollTop(),oldScroll:this.oldScroll.y,forward:"down",backward:"up"}};for(var i in e){var o=e[i],n=o.newScroll>o.oldScroll,r=n?o.forward:o.backward;for(var s in this.waypoints[i]){var a=this.waypoints[i][s],l=o.oldScroll<a.triggerPoint,h=o.newScroll>=a.triggerPoint,p=l&&h,u=!l&&!h;(p||u)&&(a.queueTrigger(r),t[a.group.id]=a.group)}}for(var c in t)t[c].flushTriggers();this.oldScroll={x:e.horizontal.newScroll,y:e.vertical.newScroll}},e.prototype.innerHeight=function(){return this.element==this.element.window?n.viewportHeight():this.adapter.innerHeight()},e.prototype.remove=function(t){delete this.waypoints[t.axis][t.key],this.checkEmpty()},e.prototype.innerWidth=function(){return this.element==this.element.window?n.viewportWidth():this.adapter.innerWidth()},e.prototype.destroy=function(){var t=[];for(var e in this.waypoints)for(var i in this.waypoints[e])t.push(this.waypoints[e][i]);for(var o=0,n=t.length;n>o;o++)t[o].destroy()},e.prototype.refresh=function(){var t,e=this.element==this.element.window,i=e?void 0:this.adapter.offset(),o={};this.handleScroll(),t={horizontal:{contextOffset:e?0:i.left,contextScroll:e?0:this.oldScroll.x,contextDimension:this.innerWidth(),oldScroll:this.oldScroll.x,forward:"right",backward:"left",offsetProp:"left"},vertical:{contextOffset:e?0:i.top,contextScroll:e?0:this.oldScroll.y,contextDimension:this.innerHeight(),oldScroll:this.oldScroll.y,forward:"down",backward:"up",offsetProp:"top"}};for(var r in t){var s=t[r];for(var a in this.waypoints[r]){var l,h,p,u,c,d=this.waypoints[r][a],f=d.options.offset,w=d.triggerPoint,y=0,g=null==w;d.element!==d.element.window&&(y=d.adapter.offset()[s.offsetProp]),"function"==typeof f?f=f.apply(d):"string"==typeof f&&(f=parseFloat(f),d.options.offset.indexOf("%")>-1&&(f=Math.ceil(s.contextDimension*f/100))),l=s.contextScroll-s.contextOffset,d.triggerPoint=y+l-f,h=w<s.oldScroll,p=d.triggerPoint>=s.oldScroll,u=h&&p,c=!h&&!p,!g&&u?(d.queueTrigger(s.backward),o[d.group.id]=d.group):!g&&c?(d.queueTrigger(s.forward),o[d.group.id]=d.group):g&&s.oldScroll>=d.triggerPoint&&(d.queueTrigger(s.forward),o[d.group.id]=d.group)}}return n.requestAnimationFrame(function(){for(var t in o)o[t].flushTriggers()}),this},e.findOrCreateByElement=function(t){return e.findByElement(t)||new e(t)},e.refreshAll=function(){for(var t in o)o[t].refresh()},e.findByElement=function(t){return o[t.waypointContextKey]},window.onload=function(){r&&r(),e.refreshAll()},n.requestAnimationFrame=function(e){var i=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||t;i.call(window,e)},n.Context=e}(),function(){"use strict";function t(t,e){return t.triggerPoint-e.triggerPoint}function e(t,e){return e.triggerPoint-t.triggerPoint}function i(t){this.name=t.name,this.axis=t.axis,this.id=this.name+"-"+this.axis,this.waypoints=[],this.clearTriggerQueues(),o[this.axis][this.name]=this}var o={vertical:{},horizontal:{}},n=window.Waypoint;i.prototype.add=function(t){this.waypoints.push(t)},i.prototype.clearTriggerQueues=function(){this.triggerQueues={up:[],down:[],left:[],right:[]}},i.prototype.flushTriggers=function(){for(var i in this.triggerQueues){var o=this.triggerQueues[i],n="up"===i||"left"===i;o.sort(n?e:t);for(var r=0,s=o.length;s>r;r+=1){var a=o[r];(a.options.continuous||r===o.length-1)&&a.trigger([i])}}this.clearTriggerQueues()},i.prototype.next=function(e){this.waypoints.sort(t);var i=n.Adapter.inArray(e,this.waypoints),o=i===this.waypoints.length-1;return o?null:this.waypoints[i+1]},i.prototype.previous=function(e){this.waypoints.sort(t);var i=n.Adapter.inArray(e,this.waypoints);return i?this.waypoints[i-1]:null},i.prototype.queueTrigger=function(t,e){this.triggerQueues[e].push(t)},i.prototype.remove=function(t){var e=n.Adapter.inArray(t,this.waypoints);e>-1&&this.waypoints.splice(e,1)},i.prototype.first=function(){return this.waypoints[0]},i.prototype.last=function(){return this.waypoints[this.waypoints.length-1]},i.findOrCreate=function(t){return o[t.axis][t.name]||new i(t)},n.Group=i}(),function(){"use strict";function t(t){this.$element=e(t)}var e=window.jQuery,i=window.Waypoint;e.each(["innerHeight","innerWidth","off","offset","on","outerHeight","outerWidth","scrollLeft","scrollTop"],function(e,i){t.prototype[i]=function(){var t=Array.prototype.slice.call(arguments);return this.$element[i].apply(this.$element,t)}}),e.each(["extend","inArray","isEmptyObject"],function(i,o){t[o]=e[o]}),i.adapters.push({name:"jquery",Adapter:t}),i.Adapter=t}(),function(){"use strict";function t(t){return function(){var i=[],o=arguments[0];return t.isFunction(arguments[0])&&(o=t.extend({},arguments[1]),o.handler=arguments[0]),this.each(function(){var n=t.extend({},o,{element:this});"string"==typeof n.context&&(n.context=t(this).closest(n.context)[0]),i.push(new e(n))}),i}}var e=window.Waypoint;window.jQuery&&(window.jQuery.fn.waypoint=t(window.jQuery)),window.Zepto&&(window.Zepto.fn.waypoint=t(window.Zepto))}();;
  /*!
   * Bootstrap v3.3.7 (http://getbootstrap.com)
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under the MIT license
   */
  
  if (typeof jQuery === 'undefined') {
    throw new Error('Bootstrap\'s JavaScript requires jQuery')
  }
  
  +function ($) {
    'use strict';
    var version = $.fn.jquery.split(' ')[0].split('.')
    if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1) || (version[0] > 3)) {
      throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher, but lower than version 4')
    }
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: transition.js v3.3.7
   * http://getbootstrap.com/javascript/#transitions
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
    // ============================================================
  
    function transitionEnd() {
      var el = document.createElement('bootstrap')
  
      var transEndEventNames = {
        WebkitTransition : 'webkitTransitionEnd',
        MozTransition    : 'transitionend',
        OTransition      : 'oTransitionEnd otransitionend',
        transition       : 'transitionend'
      }
  
      for (var name in transEndEventNames) {
        if (el.style[name] !== undefined) {
          return { end: transEndEventNames[name] }
        }
      }
  
      return false // explicit for ie8 (  ._.)
    }
  
    // http://blog.alexmaccaw.com/css-transitions
    $.fn.emulateTransitionEnd = function (duration) {
      var called = false
      var $el = this
      $(this).one('bsTransitionEnd', function () { called = true })
      var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
      setTimeout(callback, duration)
      return this
    }
  
    $(function () {
      $.support.transition = transitionEnd()
  
      if (!$.support.transition) return
  
      $.event.special.bsTransitionEnd = {
        bindType: $.support.transition.end,
        delegateType: $.support.transition.end,
        handle: function (e) {
          if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
        }
      }
    })
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: alert.js v3.3.7
   * http://getbootstrap.com/javascript/#alerts
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // ALERT CLASS DEFINITION
    // ======================
  
    var dismiss = '[data-dismiss="alert"]'
    var Alert   = function (el) {
      $(el).on('click', dismiss, this.close)
    }
  
    Alert.VERSION = '3.3.7'
  
    Alert.TRANSITION_DURATION = 150
  
    Alert.prototype.close = function (e) {
      var $this    = $(this)
      var selector = $this.attr('data-target')
  
      if (!selector) {
        selector = $this.attr('href')
        selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
      }
  
      var $parent = $(selector === '#' ? [] : selector)
  
      if (e) e.preventDefault()
  
      if (!$parent.length) {
        $parent = $this.closest('.alert')
      }
  
      $parent.trigger(e = $.Event('close.bs.alert'))
  
      if (e.isDefaultPrevented()) return
  
      $parent.removeClass('in')
  
      function removeElement() {
        // detach from parent, fire event then clean up data
        $parent.detach().trigger('closed.bs.alert').remove()
      }
  
      $.support.transition && $parent.hasClass('fade') ?
        $parent
          .one('bsTransitionEnd', removeElement)
          .emulateTransitionEnd(Alert.TRANSITION_DURATION) :
        removeElement()
    }
  
  
    // ALERT PLUGIN DEFINITION
    // =======================
  
    function Plugin(option) {
      return this.each(function () {
        var $this = $(this)
        var data  = $this.data('bs.alert')
  
        if (!data) $this.data('bs.alert', (data = new Alert(this)))
        if (typeof option == 'string') data[option].call($this)
      })
    }
  
    var old = $.fn.alert
  
    $.fn.alert             = Plugin
    $.fn.alert.Constructor = Alert
  
  
    // ALERT NO CONFLICT
    // =================
  
    $.fn.alert.noConflict = function () {
      $.fn.alert = old
      return this
    }
  
  
    // ALERT DATA-API
    // ==============
  
    $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: button.js v3.3.7
   * http://getbootstrap.com/javascript/#buttons
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // BUTTON PUBLIC CLASS DEFINITION
    // ==============================
  
    var Button = function (element, options) {
      this.$element  = $(element)
      this.options   = $.extend({}, Button.DEFAULTS, options)
      this.isLoading = false
    }
  
    Button.VERSION  = '3.3.7'
  
    Button.DEFAULTS = {
      loadingText: 'loading...'
    }
  
    Button.prototype.setState = function (state) {
      var d    = 'disabled'
      var $el  = this.$element
      var val  = $el.is('input') ? 'val' : 'html'
      var data = $el.data()
  
      state += 'Text'
  
      if (data.resetText == null) $el.data('resetText', $el[val]())
  
      // push to event loop to allow forms to submit
      setTimeout($.proxy(function () {
        $el[val](data[state] == null ? this.options[state] : data[state])
  
        if (state == 'loadingText') {
          this.isLoading = true
          $el.addClass(d).attr(d, d).prop(d, true)
        } else if (this.isLoading) {
          this.isLoading = false
          $el.removeClass(d).removeAttr(d).prop(d, false)
        }
      }, this), 0)
    }
  
    Button.prototype.toggle = function () {
      var changed = true
      var $parent = this.$element.closest('[data-toggle="buttons"]')
  
      if ($parent.length) {
        var $input = this.$element.find('input')
        if ($input.prop('type') == 'radio') {
          if ($input.prop('checked')) changed = false
          $parent.find('.active').removeClass('active')
          this.$element.addClass('active')
        } else if ($input.prop('type') == 'checkbox') {
          if (($input.prop('checked')) !== this.$element.hasClass('active')) changed = false
          this.$element.toggleClass('active')
        }
        $input.prop('checked', this.$element.hasClass('active'))
        if (changed) $input.trigger('change')
      } else {
        this.$element.attr('aria-pressed', !this.$element.hasClass('active'))
        this.$element.toggleClass('active')
      }
    }
  
  
    // BUTTON PLUGIN DEFINITION
    // ========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.button')
        var options = typeof option == 'object' && option
  
        if (!data) $this.data('bs.button', (data = new Button(this, options)))
  
        if (option == 'toggle') data.toggle()
        else if (option) data.setState(option)
      })
    }
  
    var old = $.fn.button
  
    $.fn.button             = Plugin
    $.fn.button.Constructor = Button
  
  
    // BUTTON NO CONFLICT
    // ==================
  
    $.fn.button.noConflict = function () {
      $.fn.button = old
      return this
    }
  
  
    // BUTTON DATA-API
    // ===============
  
    $(document)
      .on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {
        var $btn = $(e.target).closest('.btn')
        Plugin.call($btn, 'toggle')
        if (!($(e.target).is('input[type="radio"], input[type="checkbox"]'))) {
          // Prevent double click on radios, and the double selections (so cancellation) on checkboxes
          e.preventDefault()
          // The target component still receive the focus
          if ($btn.is('input,button')) $btn.trigger('focus')
          else $btn.find('input:visible,button:visible').first().trigger('focus')
        }
      })
      .on('focus.bs.button.data-api blur.bs.button.data-api', '[data-toggle^="button"]', function (e) {
        $(e.target).closest('.btn').toggleClass('focus', /^focus(in)?$/.test(e.type))
      })
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: carousel.js v3.3.7
   * http://getbootstrap.com/javascript/#carousel
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // CAROUSEL CLASS DEFINITION
    // =========================
  
    var Carousel = function (element, options) {
      this.$element    = $(element)
      this.$indicators = this.$element.find('.carousel-indicators')
      this.options     = options
      this.paused      = null
      this.sliding     = null
      this.interval    = null
      this.$active     = null
      this.$items      = null
  
      this.options.keyboard && this.$element.on('keydown.bs.carousel', $.proxy(this.keydown, this))
  
      this.options.pause == 'hover' && !('ontouchstart' in document.documentElement) && this.$element
        .on('mouseenter.bs.carousel', $.proxy(this.pause, this))
        .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))
    }
  
    Carousel.VERSION  = '3.3.7'
  
    Carousel.TRANSITION_DURATION = 600
  
    Carousel.DEFAULTS = {
      interval: 5000,
      pause: 'hover',
      wrap: true,
      keyboard: true
    }
  
    Carousel.prototype.keydown = function (e) {
      if (/input|textarea/i.test(e.target.tagName)) return
      switch (e.which) {
        case 37: this.prev(); break
        case 39: this.next(); break
        default: return
      }
  
      e.preventDefault()
    }
  
    Carousel.prototype.cycle = function (e) {
      e || (this.paused = false)
  
      this.interval && clearInterval(this.interval)
  
      this.options.interval
        && !this.paused
        && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))
  
      return this
    }
  
    Carousel.prototype.getItemIndex = function (item) {
      this.$items = item.parent().children('.item')
      return this.$items.index(item || this.$active)
    }
  
    Carousel.prototype.getItemForDirection = function (direction, active) {
      var activeIndex = this.getItemIndex(active)
      var willWrap = (direction == 'prev' && activeIndex === 0)
                  || (direction == 'next' && activeIndex == (this.$items.length - 1))
      if (willWrap && !this.options.wrap) return active
      var delta = direction == 'prev' ? -1 : 1
      var itemIndex = (activeIndex + delta) % this.$items.length
      return this.$items.eq(itemIndex)
    }
  
    Carousel.prototype.to = function (pos) {
      var that        = this
      var activeIndex = this.getItemIndex(this.$active = this.$element.find('.item.active'))
  
      if (pos > (this.$items.length - 1) || pos < 0) return
  
      if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid"
      if (activeIndex == pos) return this.pause().cycle()
  
      return this.slide(pos > activeIndex ? 'next' : 'prev', this.$items.eq(pos))
    }
  
    Carousel.prototype.pause = function (e) {
      e || (this.paused = true)
  
      if (this.$element.find('.next, .prev').length && $.support.transition) {
        this.$element.trigger($.support.transition.end)
        this.cycle(true)
      }
  
      this.interval = clearInterval(this.interval)
  
      return this
    }
  
    Carousel.prototype.next = function () {
      if (this.sliding) return
      return this.slide('next')
    }
  
    Carousel.prototype.prev = function () {
      if (this.sliding) return
      return this.slide('prev')
    }
  
    Carousel.prototype.slide = function (type, next) {
      var $active   = this.$element.find('.item.active')
      var $next     = next || this.getItemForDirection(type, $active)
      var isCycling = this.interval
      var direction = type == 'next' ? 'left' : 'right'
      var that      = this
  
      if ($next.hasClass('active')) return (this.sliding = false)
  
      var relatedTarget = $next[0]
      var slideEvent = $.Event('slide.bs.carousel', {
        relatedTarget: relatedTarget,
        direction: direction
      })
      this.$element.trigger(slideEvent)
      if (slideEvent.isDefaultPrevented()) return
  
      this.sliding = true
  
      isCycling && this.pause()
  
      if (this.$indicators.length) {
        this.$indicators.find('.active').removeClass('active')
        var $nextIndicator = $(this.$indicators.children()[this.getItemIndex($next)])
        $nextIndicator && $nextIndicator.addClass('active')
      }
  
      var slidEvent = $.Event('slid.bs.carousel', { relatedTarget: relatedTarget, direction: direction }) // yes, "slid"
      if ($.support.transition && this.$element.hasClass('slide')) {
        $next.addClass(type)
        $next[0].offsetWidth // force reflow
        $active.addClass(direction)
        $next.addClass(direction)
        $active
          .one('bsTransitionEnd', function () {
            $next.removeClass([type, direction].join(' ')).addClass('active')
            $active.removeClass(['active', direction].join(' '))
            that.sliding = false
            setTimeout(function () {
              that.$element.trigger(slidEvent)
            }, 0)
          })
          .emulateTransitionEnd(Carousel.TRANSITION_DURATION)
      } else {
        $active.removeClass('active')
        $next.addClass('active')
        this.sliding = false
        this.$element.trigger(slidEvent)
      }
  
      isCycling && this.cycle()
  
      return this
    }
  
  
    // CAROUSEL PLUGIN DEFINITION
    // ==========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.carousel')
        var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)
        var action  = typeof option == 'string' ? option : options.slide
  
        if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))
        if (typeof option == 'number') data.to(option)
        else if (action) data[action]()
        else if (options.interval) data.pause().cycle()
      })
    }
  
    var old = $.fn.carousel
  
    $.fn.carousel             = Plugin
    $.fn.carousel.Constructor = Carousel
  
  
    // CAROUSEL NO CONFLICT
    // ====================
  
    $.fn.carousel.noConflict = function () {
      $.fn.carousel = old
      return this
    }
  
  
    // CAROUSEL DATA-API
    // =================
  
    var clickHandler = function (e) {
      var href
      var $this   = $(this)
      var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) // strip for ie7
      if (!$target.hasClass('carousel')) return
      var options = $.extend({}, $target.data(), $this.data())
      var slideIndex = $this.attr('data-slide-to')
      if (slideIndex) options.interval = false
  
      Plugin.call($target, options)
  
      if (slideIndex) {
        $target.data('bs.carousel').to(slideIndex)
      }
  
      e.preventDefault()
    }
  
    $(document)
      .on('click.bs.carousel.data-api', '[data-slide]', clickHandler)
      .on('click.bs.carousel.data-api', '[data-slide-to]', clickHandler)
  
    $(window).on('load', function () {
      $('[data-ride="carousel"]').each(function () {
        var $carousel = $(this)
        Plugin.call($carousel, $carousel.data())
      })
    })
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: collapse.js v3.3.7
   * http://getbootstrap.com/javascript/#collapse
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  /* jshint latedef: false */
  
  +function ($) {
    'use strict';
  
    // COLLAPSE PUBLIC CLASS DEFINITION
    // ================================
  
    var Collapse = function (element, options) {
      this.$element      = $(element)
      this.options       = $.extend({}, Collapse.DEFAULTS, options)
      this.$trigger      = $('[data-toggle="collapse"][href="#' + element.id + '"],' +
                             '[data-toggle="collapse"][data-target="#' + element.id + '"]')
      this.transitioning = null
  
      if (this.options.parent) {
        this.$parent = this.getParent()
      } else {
        this.addAriaAndCollapsedClass(this.$element, this.$trigger)
      }
  
      if (this.options.toggle) this.toggle()
    }
  
    Collapse.VERSION  = '3.3.7'
  
    Collapse.TRANSITION_DURATION = 350
  
    Collapse.DEFAULTS = {
      toggle: true
    }
  
    Collapse.prototype.dimension = function () {
      var hasWidth = this.$element.hasClass('width')
      return hasWidth ? 'width' : 'height'
    }
  
    Collapse.prototype.show = function () {
      if (this.transitioning || this.$element.hasClass('in')) return
  
      var activesData
      var actives = this.$parent && this.$parent.children('.panel').children('.in, .collapsing')
  
      if (actives && actives.length) {
        activesData = actives.data('bs.collapse')
        if (activesData && activesData.transitioning) return
      }
  
      var startEvent = $.Event('show.bs.collapse')
      this.$element.trigger(startEvent)
      if (startEvent.isDefaultPrevented()) return
  
      if (actives && actives.length) {
        Plugin.call(actives, 'hide')
        activesData || actives.data('bs.collapse', null)
      }
  
      var dimension = this.dimension()
  
      this.$element
        .removeClass('collapse')
        .addClass('collapsing')[dimension](0)
        .attr('aria-expanded', true)
  
      this.$trigger
        .removeClass('collapsed')
        .attr('aria-expanded', true)
  
      this.transitioning = 1
  
      var complete = function () {
        this.$element
          .removeClass('collapsing')
          .addClass('collapse in')[dimension]('')
        this.transitioning = 0
        this.$element
          .trigger('shown.bs.collapse')
      }
  
      if (!$.support.transition) return complete.call(this)
  
      var scrollSize = $.camelCase(['scroll', dimension].join('-'))
  
      this.$element
        .one('bsTransitionEnd', $.proxy(complete, this))
        .emulateTransitionEnd(Collapse.TRANSITION_DURATION)[dimension](this.$element[0][scrollSize])
    }
  
    Collapse.prototype.hide = function () {
      if (this.transitioning || !this.$element.hasClass('in')) return
  
      var startEvent = $.Event('hide.bs.collapse')
      this.$element.trigger(startEvent)
      if (startEvent.isDefaultPrevented()) return
  
      var dimension = this.dimension()
  
      this.$element[dimension](this.$element[dimension]())[0].offsetHeight
  
      this.$element
        .addClass('collapsing')
        .removeClass('collapse in')
        .attr('aria-expanded', false)
  
      this.$trigger
        .addClass('collapsed')
        .attr('aria-expanded', false)
  
      this.transitioning = 1
  
      var complete = function () {
        this.transitioning = 0
        this.$element
          .removeClass('collapsing')
          .addClass('collapse')
          .trigger('hidden.bs.collapse')
      }
  
      if (!$.support.transition) return complete.call(this)
  
      this.$element
        [dimension](0)
        .one('bsTransitionEnd', $.proxy(complete, this))
        .emulateTransitionEnd(Collapse.TRANSITION_DURATION)
    }
  
    Collapse.prototype.toggle = function () {
      this[this.$element.hasClass('in') ? 'hide' : 'show']()
    }
  
    Collapse.prototype.getParent = function () {
      return $(this.options.parent)
        .find('[data-toggle="collapse"][data-parent="' + this.options.parent + '"]')
        .each($.proxy(function (i, element) {
          var $element = $(element)
          this.addAriaAndCollapsedClass(getTargetFromTrigger($element), $element)
        }, this))
        .end()
    }
  
    Collapse.prototype.addAriaAndCollapsedClass = function ($element, $trigger) {
      var isOpen = $element.hasClass('in')
  
      $element.attr('aria-expanded', isOpen)
      $trigger
        .toggleClass('collapsed', !isOpen)
        .attr('aria-expanded', isOpen)
    }
  
    function getTargetFromTrigger($trigger) {
      var href
      var target = $trigger.attr('data-target')
        || (href = $trigger.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7
  
      return $(target)
    }
  
  
    // COLLAPSE PLUGIN DEFINITION
    // ==========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.collapse')
        var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)
  
        if (!data && options.toggle && /show|hide/.test(option)) options.toggle = false
        if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.collapse
  
    $.fn.collapse             = Plugin
    $.fn.collapse.Constructor = Collapse
  
  
    // COLLAPSE NO CONFLICT
    // ====================
  
    $.fn.collapse.noConflict = function () {
      $.fn.collapse = old
      return this
    }
  
  
    // COLLAPSE DATA-API
    // =================
  
    $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
      var $this   = $(this)
  
      if (!$this.attr('data-target')) e.preventDefault()
  
      var $target = getTargetFromTrigger($this)
      var data    = $target.data('bs.collapse')
      var option  = data ? 'toggle' : $this.data()
  
      Plugin.call($target, option)
    })
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: dropdown.js v3.3.7
   * http://getbootstrap.com/javascript/#dropdowns
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // DROPDOWN CLASS DEFINITION
    // =========================
  
    var backdrop = '.dropdown-backdrop'
    var toggle   = '[data-toggle="dropdown"]'
    var Dropdown = function (element) {
      $(element).on('click.bs.dropdown', this.toggle)
    }
  
    Dropdown.VERSION = '3.3.7'
  
    function getParent($this) {
      var selector = $this.attr('data-target')
  
      if (!selector) {
        selector = $this.attr('href')
        selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
      }
  
      var $parent = selector && $(selector)
  
      return $parent && $parent.length ? $parent : $this.parent()
    }
  
    function clearMenus(e) {
      if (e && e.which === 3) return
      $(backdrop).remove()
      $(toggle).each(function () {
        var $this         = $(this)
        var $parent       = getParent($this)
        var relatedTarget = { relatedTarget: this }
  
        if (!$parent.hasClass('open')) return
  
        if (e && e.type == 'click' && /input|textarea/i.test(e.target.tagName) && $.contains($parent[0], e.target)) return
  
        $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))
  
        if (e.isDefaultPrevented()) return
  
        $this.attr('aria-expanded', 'false')
        $parent.removeClass('open').trigger($.Event('hidden.bs.dropdown', relatedTarget))
      })
    }
  
    Dropdown.prototype.toggle = function (e) {
      var $this = $(this)
  
      if ($this.is('.disabled, :disabled')) return
  
      var $parent  = getParent($this)
      var isActive = $parent.hasClass('open')
  
      clearMenus()
  
      if (!isActive) {
        if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
          // if mobile we use a backdrop because click events don't delegate
          $(document.createElement('div'))
            .addClass('dropdown-backdrop')
            .insertAfter($(this))
            .on('click', clearMenus)
        }
  
        var relatedTarget = { relatedTarget: this }
        $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))
  
        if (e.isDefaultPrevented()) return
  
        $this
          .trigger('focus')
          .attr('aria-expanded', 'true')
  
        $parent
          .toggleClass('open')
          .trigger($.Event('shown.bs.dropdown', relatedTarget))
      }
  
      return false
    }
  
    Dropdown.prototype.keydown = function (e) {
      if (!/(38|40|27|32)/.test(e.which) || /input|textarea/i.test(e.target.tagName)) return
  
      var $this = $(this)
  
      e.preventDefault()
      e.stopPropagation()
  
      if ($this.is('.disabled, :disabled')) return
  
      var $parent  = getParent($this)
      var isActive = $parent.hasClass('open')
  
      if (!isActive && e.which != 27 || isActive && e.which == 27) {
        if (e.which == 27) $parent.find(toggle).trigger('focus')
        return $this.trigger('click')
      }
  
      var desc = ' li:not(.disabled):visible a'
      var $items = $parent.find('.dropdown-menu' + desc)
  
      if (!$items.length) return
  
      var index = $items.index(e.target)
  
      if (e.which == 38 && index > 0)                 index--         // up
      if (e.which == 40 && index < $items.length - 1) index++         // down
      if (!~index)                                    index = 0
  
      $items.eq(index).trigger('focus')
    }
  
  
    // DROPDOWN PLUGIN DEFINITION
    // ==========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this = $(this)
        var data  = $this.data('bs.dropdown')
  
        if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
        if (typeof option == 'string') data[option].call($this)
      })
    }
  
    var old = $.fn.dropdown
  
    $.fn.dropdown             = Plugin
    $.fn.dropdown.Constructor = Dropdown
  
  
    // DROPDOWN NO CONFLICT
    // ====================
  
    $.fn.dropdown.noConflict = function () {
      $.fn.dropdown = old
      return this
    }
  
  
    // APPLY TO STANDARD DROPDOWN ELEMENTS
    // ===================================
  
    $(document)
      .on('click.bs.dropdown.data-api', clearMenus)
      .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
      .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
      .on('keydown.bs.dropdown.data-api', toggle, Dropdown.prototype.keydown)
      .on('keydown.bs.dropdown.data-api', '.dropdown-menu', Dropdown.prototype.keydown)
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: modal.js v3.3.7
   * http://getbootstrap.com/javascript/#modals
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // MODAL CLASS DEFINITION
    // ======================
  
    var Modal = function (element, options) {
      this.options             = options
      this.$body               = $(document.body)
      this.$element            = $(element)
      this.$dialog             = this.$element.find('.modal-dialog')
      this.$backdrop           = null
      this.isShown             = null
      this.originalBodyPad     = null
      this.scrollbarWidth      = 0
      this.ignoreBackdropClick = false
  
      if (this.options.remote) {
        this.$element
          .find('.modal-content')
          .load(this.options.remote, $.proxy(function () {
            this.$element.trigger('loaded.bs.modal')
          }, this))
      }
    }
  
    Modal.VERSION  = '3.3.7'
  
    Modal.TRANSITION_DURATION = 300
    Modal.BACKDROP_TRANSITION_DURATION = 150
  
    Modal.DEFAULTS = {
      backdrop: true,
      keyboard: true,
      show: true
    }
  
    Modal.prototype.toggle = function (_relatedTarget) {
      return this.isShown ? this.hide() : this.show(_relatedTarget)
    }
  
    Modal.prototype.show = function (_relatedTarget) {
      var that = this
      var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })
  
      this.$element.trigger(e)
  
      if (this.isShown || e.isDefaultPrevented()) return
  
      this.isShown = true
  
      this.checkScrollbar()
      this.setScrollbar()
      this.$body.addClass('modal-open')
  
      this.escape()
      this.resize()
  
      this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))
  
      this.$dialog.on('mousedown.dismiss.bs.modal', function () {
        that.$element.one('mouseup.dismiss.bs.modal', function (e) {
          if ($(e.target).is(that.$element)) that.ignoreBackdropClick = true
        })
      })
  
      this.backdrop(function () {
        var transition = $.support.transition && that.$element.hasClass('fade')
  
        if (!that.$element.parent().length) {
          that.$element.appendTo(that.$body) // don't move modals dom position
        }
  
        that.$element
          .show()
          .scrollTop(0)
  
        that.adjustDialog()
  
        if (transition) {
          that.$element[0].offsetWidth // force reflow
        }
  
        that.$element.addClass('in')
  
        that.enforceFocus()
  
        var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })
  
        transition ?
          that.$dialog // wait for modal to slide in
            .one('bsTransitionEnd', function () {
              that.$element.trigger('focus').trigger(e)
            })
            .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
          that.$element.trigger('focus').trigger(e)
      })
    }
  
    Modal.prototype.hide = function (e) {
      if (e) e.preventDefault()
  
      e = $.Event('hide.bs.modal')
  
      this.$element.trigger(e)
  
      if (!this.isShown || e.isDefaultPrevented()) return
  
      this.isShown = false
  
      this.escape()
      this.resize()
  
      $(document).off('focusin.bs.modal')
  
      this.$element
        .removeClass('in')
        .off('click.dismiss.bs.modal')
        .off('mouseup.dismiss.bs.modal')
  
      this.$dialog.off('mousedown.dismiss.bs.modal')
  
      $.support.transition && this.$element.hasClass('fade') ?
        this.$element
          .one('bsTransitionEnd', $.proxy(this.hideModal, this))
          .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
        this.hideModal()
    }
  
    Modal.prototype.enforceFocus = function () {
      $(document)
        .off('focusin.bs.modal') // guard against infinite focus loop
        .on('focusin.bs.modal', $.proxy(function (e) {
          if (document !== e.target &&
              this.$element[0] !== e.target &&
              !this.$element.has(e.target).length) {
            this.$element.trigger('focus')
          }
        }, this))
    }
  
    Modal.prototype.escape = function () {
      if (this.isShown && this.options.keyboard) {
        this.$element.on('keydown.dismiss.bs.modal', $.proxy(function (e) {
          e.which == 27 && this.hide()
        }, this))
      } else if (!this.isShown) {
        this.$element.off('keydown.dismiss.bs.modal')
      }
    }
  
    Modal.prototype.resize = function () {
      if (this.isShown) {
        $(window).on('resize.bs.modal', $.proxy(this.handleUpdate, this))
      } else {
        $(window).off('resize.bs.modal')
      }
    }
  
    Modal.prototype.hideModal = function () {
      var that = this
      this.$element.hide()
      this.backdrop(function () {
        that.$body.removeClass('modal-open')
        that.resetAdjustments()
        that.resetScrollbar()
        that.$element.trigger('hidden.bs.modal')
      })
    }
  
    Modal.prototype.removeBackdrop = function () {
      this.$backdrop && this.$backdrop.remove()
      this.$backdrop = null
    }
  
    Modal.prototype.backdrop = function (callback) {
      var that = this
      var animate = this.$element.hasClass('fade') ? 'fade' : ''
  
      if (this.isShown && this.options.backdrop) {
        var doAnimate = $.support.transition && animate
  
        this.$backdrop = $(document.createElement('div'))
          .addClass('modal-backdrop ' + animate)
          .appendTo(this.$body)
  
        this.$element.on('click.dismiss.bs.modal', $.proxy(function (e) {
          if (this.ignoreBackdropClick) {
            this.ignoreBackdropClick = false
            return
          }
          if (e.target !== e.currentTarget) return
          this.options.backdrop == 'static'
            ? this.$element[0].focus()
            : this.hide()
        }, this))
  
        if (doAnimate) this.$backdrop[0].offsetWidth // force reflow
  
        this.$backdrop.addClass('in')
  
        if (!callback) return
  
        doAnimate ?
          this.$backdrop
            .one('bsTransitionEnd', callback)
            .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
          callback()
  
      } else if (!this.isShown && this.$backdrop) {
        this.$backdrop.removeClass('in')
  
        var callbackRemove = function () {
          that.removeBackdrop()
          callback && callback()
        }
        $.support.transition && this.$element.hasClass('fade') ?
          this.$backdrop
            .one('bsTransitionEnd', callbackRemove)
            .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
          callbackRemove()
  
      } else if (callback) {
        callback()
      }
    }
  
    // these following methods are used to handle overflowing modals
  
    Modal.prototype.handleUpdate = function () {
      this.adjustDialog()
    }
  
    Modal.prototype.adjustDialog = function () {
      var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight
  
      this.$element.css({
        paddingLeft:  !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',
        paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''
      })
    }
  
    Modal.prototype.resetAdjustments = function () {
      this.$element.css({
        paddingLeft: '',
        paddingRight: ''
      })
    }
  
    Modal.prototype.checkScrollbar = function () {
      var fullWindowWidth = window.innerWidth
      if (!fullWindowWidth) { // workaround for missing window.innerWidth in IE8
        var documentElementRect = document.documentElement.getBoundingClientRect()
        fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left)
      }
      this.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth
      this.scrollbarWidth = this.measureScrollbar()
    }
  
    Modal.prototype.setScrollbar = function () {
      var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
      this.originalBodyPad = document.body.style.paddingRight || ''
      if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
    }
  
    Modal.prototype.resetScrollbar = function () {
      this.$body.css('padding-right', this.originalBodyPad)
    }
  
    Modal.prototype.measureScrollbar = function () { // thx walsh
      var scrollDiv = document.createElement('div')
      scrollDiv.className = 'modal-scrollbar-measure'
      this.$body.append(scrollDiv)
      var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
      this.$body[0].removeChild(scrollDiv)
      return scrollbarWidth
    }
  
  
    // MODAL PLUGIN DEFINITION
    // =======================
  
    function Plugin(option, _relatedTarget) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.modal')
        var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)
  
        if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
        if (typeof option == 'string') data[option](_relatedTarget)
        else if (options.show) data.show(_relatedTarget)
      })
    }
  
    var old = $.fn.modal
  
    $.fn.modal             = Plugin
    $.fn.modal.Constructor = Modal
  
  
    // MODAL NO CONFLICT
    // =================
  
    $.fn.modal.noConflict = function () {
      $.fn.modal = old
      return this
    }
  
  
    // MODAL DATA-API
    // ==============
  
    $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
      var $this   = $(this)
      var href    = $this.attr('href')
      var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
      var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())
  
      if ($this.is('a')) e.preventDefault()
  
      $target.one('show.bs.modal', function (showEvent) {
        if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown
        $target.one('hidden.bs.modal', function () {
          $this.is(':visible') && $this.trigger('focus')
        })
      })
      Plugin.call($target, option, this)
    })
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: tooltip.js v3.3.7
   * http://getbootstrap.com/javascript/#tooltip
   * Inspired by the original jQuery.tipsy by Jason Frame
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // TOOLTIP PUBLIC CLASS DEFINITION
    // ===============================
  
    var Tooltip = function (element, options) {
      this.type       = null
      this.options    = null
      this.enabled    = null
      this.timeout    = null
      this.hoverState = null
      this.$element   = null
      this.inState    = null
  
      this.init('tooltip', element, options)
    }
  
    Tooltip.VERSION  = '3.3.7'
  
    Tooltip.TRANSITION_DURATION = 150
  
    Tooltip.DEFAULTS = {
      animation: true,
      placement: 'top',
      selector: false,
      template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
      trigger: 'hover focus',
      title: '',
      delay: 0,
      html: false,
      container: false,
      viewport: {
        selector: 'body',
        padding: 0
      }
    }
  
    Tooltip.prototype.init = function (type, element, options) {
      this.enabled   = true
      this.type      = type
      this.$element  = $(element)
      this.options   = this.getOptions(options)
      this.$viewport = this.options.viewport && $($.isFunction(this.options.viewport) ? this.options.viewport.call(this, this.$element) : (this.options.viewport.selector || this.options.viewport))
      this.inState   = { click: false, hover: false, focus: false }
  
      if (this.$element[0] instanceof document.constructor && !this.options.selector) {
        throw new Error('`selector` option must be specified when initializing ' + this.type + ' on the window.document object!')
      }
  
      var triggers = this.options.trigger.split(' ')
  
      for (var i = triggers.length; i--;) {
        var trigger = triggers[i]
  
        if (trigger == 'click') {
          this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
        } else if (trigger != 'manual') {
          var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
          var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'
  
          this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
          this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
        }
      }
  
      this.options.selector ?
        (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
        this.fixTitle()
    }
  
    Tooltip.prototype.getDefaults = function () {
      return Tooltip.DEFAULTS
    }
  
    Tooltip.prototype.getOptions = function (options) {
      options = $.extend({}, this.getDefaults(), this.$element.data(), options)
  
      if (options.delay && typeof options.delay == 'number') {
        options.delay = {
          show: options.delay,
          hide: options.delay
        }
      }
  
      return options
    }
  
    Tooltip.prototype.getDelegateOptions = function () {
      var options  = {}
      var defaults = this.getDefaults()
  
      this._options && $.each(this._options, function (key, value) {
        if (defaults[key] != value) options[key] = value
      })
  
      return options
    }
  
    Tooltip.prototype.enter = function (obj) {
      var self = obj instanceof this.constructor ?
        obj : $(obj.currentTarget).data('bs.' + this.type)
  
      if (!self) {
        self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
        $(obj.currentTarget).data('bs.' + this.type, self)
      }
  
      if (obj instanceof $.Event) {
        self.inState[obj.type == 'focusin' ? 'focus' : 'hover'] = true
      }
  
      if (self.tip().hasClass('in') || self.hoverState == 'in') {
        self.hoverState = 'in'
        return
      }
  
      clearTimeout(self.timeout)
  
      self.hoverState = 'in'
  
      if (!self.options.delay || !self.options.delay.show) return self.show()
  
      self.timeout = setTimeout(function () {
        if (self.hoverState == 'in') self.show()
      }, self.options.delay.show)
    }
  
    Tooltip.prototype.isInStateTrue = function () {
      for (var key in this.inState) {
        if (this.inState[key]) return true
      }
  
      return false
    }
  
    Tooltip.prototype.leave = function (obj) {
      var self = obj instanceof this.constructor ?
        obj : $(obj.currentTarget).data('bs.' + this.type)
  
      if (!self) {
        self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
        $(obj.currentTarget).data('bs.' + this.type, self)
      }
  
      if (obj instanceof $.Event) {
        self.inState[obj.type == 'focusout' ? 'focus' : 'hover'] = false
      }
  
      if (self.isInStateTrue()) return
  
      clearTimeout(self.timeout)
  
      self.hoverState = 'out'
  
      if (!self.options.delay || !self.options.delay.hide) return self.hide()
  
      self.timeout = setTimeout(function () {
        if (self.hoverState == 'out') self.hide()
      }, self.options.delay.hide)
    }
  
    Tooltip.prototype.show = function () {
      var e = $.Event('show.bs.' + this.type)
  
      if (this.hasContent() && this.enabled) {
        this.$element.trigger(e)
  
        var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])
        if (e.isDefaultPrevented() || !inDom) return
        var that = this
  
        var $tip = this.tip()
  
        var tipId = this.getUID(this.type)
  
        this.setContent()
        $tip.attr('id', tipId)
        this.$element.attr('aria-describedby', tipId)
  
        if (this.options.animation) $tip.addClass('fade')
  
        var placement = typeof this.options.placement == 'function' ?
          this.options.placement.call(this, $tip[0], this.$element[0]) :
          this.options.placement
  
        var autoToken = /\s?auto?\s?/i
        var autoPlace = autoToken.test(placement)
        if (autoPlace) placement = placement.replace(autoToken, '') || 'top'
  
        $tip
          .detach()
          .css({ top: 0, left: 0, display: 'block' })
          .addClass(placement)
          .data('bs.' + this.type, this)
  
        this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)
        this.$element.trigger('inserted.bs.' + this.type)
  
        var pos          = this.getPosition()
        var actualWidth  = $tip[0].offsetWidth
        var actualHeight = $tip[0].offsetHeight
  
        if (autoPlace) {
          var orgPlacement = placement
          var viewportDim = this.getPosition(this.$viewport)
  
          placement = placement == 'bottom' && pos.bottom + actualHeight > viewportDim.bottom ? 'top'    :
                      placement == 'top'    && pos.top    - actualHeight < viewportDim.top    ? 'bottom' :
                      placement == 'right'  && pos.right  + actualWidth  > viewportDim.width  ? 'left'   :
                      placement == 'left'   && pos.left   - actualWidth  < viewportDim.left   ? 'right'  :
                      placement
  
          $tip
            .removeClass(orgPlacement)
            .addClass(placement)
        }
  
        var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)
  
        this.applyPlacement(calculatedOffset, placement)
  
        var complete = function () {
          var prevHoverState = that.hoverState
          that.$element.trigger('shown.bs.' + that.type)
          that.hoverState = null
  
          if (prevHoverState == 'out') that.leave(that)
        }
  
        $.support.transition && this.$tip.hasClass('fade') ?
          $tip
            .one('bsTransitionEnd', complete)
            .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
          complete()
      }
    }
  
    Tooltip.prototype.applyPlacement = function (offset, placement) {
      var $tip   = this.tip()
      var width  = $tip[0].offsetWidth
      var height = $tip[0].offsetHeight
  
      // manually read margins because getBoundingClientRect includes difference
      var marginTop = parseInt($tip.css('margin-top'), 10)
      var marginLeft = parseInt($tip.css('margin-left'), 10)
  
      // we must check for NaN for ie 8/9
      if (isNaN(marginTop))  marginTop  = 0
      if (isNaN(marginLeft)) marginLeft = 0
  
      offset.top  += marginTop
      offset.left += marginLeft
  
      // $.fn.offset doesn't round pixel values
      // so we use setOffset directly with our own function B-0
      $.offset.setOffset($tip[0], $.extend({
        using: function (props) {
          $tip.css({
            top: Math.round(props.top),
            left: Math.round(props.left)
          })
        }
      }, offset), 0)
  
      $tip.addClass('in')
  
      // check to see if placing tip in new offset caused the tip to resize itself
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight
  
      if (placement == 'top' && actualHeight != height) {
        offset.top = offset.top + height - actualHeight
      }
  
      var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)
  
      if (delta.left) offset.left += delta.left
      else offset.top += delta.top
  
      var isVertical          = /top|bottom/.test(placement)
      var arrowDelta          = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
      var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'
  
      $tip.offset(offset)
      this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)
    }
  
    Tooltip.prototype.replaceArrow = function (delta, dimension, isVertical) {
      this.arrow()
        .css(isVertical ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')
        .css(isVertical ? 'top' : 'left', '')
    }
  
    Tooltip.prototype.setContent = function () {
      var $tip  = this.tip()
      var title = this.getTitle()
  
      $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
      $tip.removeClass('fade in top bottom left right')
    }
  
    Tooltip.prototype.hide = function (callback) {
      var that = this
      var $tip = $(this.$tip)
      var e    = $.Event('hide.bs.' + this.type)
  
      function complete() {
        if (that.hoverState != 'in') $tip.detach()
        if (that.$element) { // TODO: Check whether guarding this code with this `if` is really necessary.
          that.$element
            .removeAttr('aria-describedby')
            .trigger('hidden.bs.' + that.type)
        }
        callback && callback()
      }
  
      this.$element.trigger(e)
  
      if (e.isDefaultPrevented()) return
  
      $tip.removeClass('in')
  
      $.support.transition && $tip.hasClass('fade') ?
        $tip
          .one('bsTransitionEnd', complete)
          .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
        complete()
  
      this.hoverState = null
  
      return this
    }
  
    Tooltip.prototype.fixTitle = function () {
      var $e = this.$element
      if ($e.attr('title') || typeof $e.attr('data-original-title') != 'string') {
        $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
      }
    }
  
    Tooltip.prototype.hasContent = function () {
      return this.getTitle()
    }
  
    Tooltip.prototype.getPosition = function ($element) {
      $element   = $element || this.$element
  
      var el     = $element[0]
      var isBody = el.tagName == 'BODY'
  
      var elRect    = el.getBoundingClientRect()
      if (elRect.width == null) {
        // width and height are missing in IE8, so compute them manually; see https://github.com/twbs/bootstrap/issues/14093
        elRect = $.extend({}, elRect, { width: elRect.right - elRect.left, height: elRect.bottom - elRect.top })
      }
      var isSvg = window.SVGElement && el instanceof window.SVGElement
      // Avoid using $.offset() on SVGs since it gives incorrect results in jQuery 3.
      // See https://github.com/twbs/bootstrap/issues/20280
      var elOffset  = isBody ? { top: 0, left: 0 } : (isSvg ? null : $element.offset())
      var scroll    = { scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop() }
      var outerDims = isBody ? { width: $(window).width(), height: $(window).height() } : null
  
      return $.extend({}, elRect, scroll, outerDims, elOffset)
    }
  
    Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
      return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2 } :
             placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 } :
             placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
          /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width }
  
    }
  
    Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
      var delta = { top: 0, left: 0 }
      if (!this.$viewport) return delta
  
      var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
      var viewportDimensions = this.getPosition(this.$viewport)
  
      if (/right|left/.test(placement)) {
        var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
        var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
        if (topEdgeOffset < viewportDimensions.top) { // top overflow
          delta.top = viewportDimensions.top - topEdgeOffset
        } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
          delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
        }
      } else {
        var leftEdgeOffset  = pos.left - viewportPadding
        var rightEdgeOffset = pos.left + viewportPadding + actualWidth
        if (leftEdgeOffset < viewportDimensions.left) { // left overflow
          delta.left = viewportDimensions.left - leftEdgeOffset
        } else if (rightEdgeOffset > viewportDimensions.right) { // right overflow
          delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
        }
      }
  
      return delta
    }
  
    Tooltip.prototype.getTitle = function () {
      var title
      var $e = this.$element
      var o  = this.options
  
      title = $e.attr('data-original-title')
        || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)
  
      return title
    }
  
    Tooltip.prototype.getUID = function (prefix) {
      do prefix += ~~(Math.random() * 1000000)
      while (document.getElementById(prefix))
      return prefix
    }
  
    Tooltip.prototype.tip = function () {
      if (!this.$tip) {
        this.$tip = $(this.options.template)
        if (this.$tip.length != 1) {
          throw new Error(this.type + ' `template` option must consist of exactly 1 top-level element!')
        }
      }
      return this.$tip
    }
  
    Tooltip.prototype.arrow = function () {
      return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))
    }
  
    Tooltip.prototype.enable = function () {
      this.enabled = true
    }
  
    Tooltip.prototype.disable = function () {
      this.enabled = false
    }
  
    Tooltip.prototype.toggleEnabled = function () {
      this.enabled = !this.enabled
    }
  
    Tooltip.prototype.toggle = function (e) {
      var self = this
      if (e) {
        self = $(e.currentTarget).data('bs.' + this.type)
        if (!self) {
          self = new this.constructor(e.currentTarget, this.getDelegateOptions())
          $(e.currentTarget).data('bs.' + this.type, self)
        }
      }
  
      if (e) {
        self.inState.click = !self.inState.click
        if (self.isInStateTrue()) self.enter(self)
        else self.leave(self)
      } else {
        self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
      }
    }
  
    Tooltip.prototype.destroy = function () {
      var that = this
      clearTimeout(this.timeout)
      this.hide(function () {
        that.$element.off('.' + that.type).removeData('bs.' + that.type)
        if (that.$tip) {
          that.$tip.detach()
        }
        that.$tip = null
        that.$arrow = null
        that.$viewport = null
        that.$element = null
      })
    }
  
  
    // TOOLTIP PLUGIN DEFINITION
    // =========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.tooltip')
        var options = typeof option == 'object' && option
  
        if (!data && /destroy|hide/.test(option)) return
        if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.tooltip
  
    $.fn.tooltip             = Plugin
    $.fn.tooltip.Constructor = Tooltip
  
  
    // TOOLTIP NO CONFLICT
    // ===================
  
    $.fn.tooltip.noConflict = function () {
      $.fn.tooltip = old
      return this
    }
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: popover.js v3.3.7
   * http://getbootstrap.com/javascript/#popovers
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // POPOVER PUBLIC CLASS DEFINITION
    // ===============================
  
    var Popover = function (element, options) {
      this.init('popover', element, options)
    }
  
    if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')
  
    Popover.VERSION  = '3.3.7'
  
    Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
      placement: 'right',
      trigger: 'click',
      content: '',
      template: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
    })
  
  
    // NOTE: POPOVER EXTENDS tooltip.js
    // ================================
  
    Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)
  
    Popover.prototype.constructor = Popover
  
    Popover.prototype.getDefaults = function () {
      return Popover.DEFAULTS
    }
  
    Popover.prototype.setContent = function () {
      var $tip    = this.tip()
      var title   = this.getTitle()
      var content = this.getContent()
  
      $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
      $tip.find('.popover-content').children().detach().end()[ // we use append for html objects to maintain js events
        this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
      ](content)
  
      $tip.removeClass('fade top bottom left right in')
  
      // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
      // this manually by checking the contents.
      if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()
    }
  
    Popover.prototype.hasContent = function () {
      return this.getTitle() || this.getContent()
    }
  
    Popover.prototype.getContent = function () {
      var $e = this.$element
      var o  = this.options
  
      return $e.attr('data-content')
        || (typeof o.content == 'function' ?
              o.content.call($e[0]) :
              o.content)
    }
  
    Popover.prototype.arrow = function () {
      return (this.$arrow = this.$arrow || this.tip().find('.arrow'))
    }
  
  
    // POPOVER PLUGIN DEFINITION
    // =========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.popover')
        var options = typeof option == 'object' && option
  
        if (!data && /destroy|hide/.test(option)) return
        if (!data) $this.data('bs.popover', (data = new Popover(this, options)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.popover
  
    $.fn.popover             = Plugin
    $.fn.popover.Constructor = Popover
  
  
    // POPOVER NO CONFLICT
    // ===================
  
    $.fn.popover.noConflict = function () {
      $.fn.popover = old
      return this
    }
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: scrollspy.js v3.3.7
   * http://getbootstrap.com/javascript/#scrollspy
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // SCROLLSPY CLASS DEFINITION
    // ==========================
  
    function ScrollSpy(element, options) {
      this.$body          = $(document.body)
      this.$scrollElement = $(element).is(document.body) ? $(window) : $(element)
      this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
      this.selector       = (this.options.target || '') + ' .nav li > a'
      this.offsets        = []
      this.targets        = []
      this.activeTarget   = null
      this.scrollHeight   = 0
  
      this.$scrollElement.on('scroll.bs.scrollspy', $.proxy(this.process, this))
      this.refresh()
      this.process()
    }
  
    ScrollSpy.VERSION  = '3.3.7'
  
    ScrollSpy.DEFAULTS = {
      offset: 10
    }
  
    ScrollSpy.prototype.getScrollHeight = function () {
      return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
    }
  
    ScrollSpy.prototype.refresh = function () {
      var that          = this
      var offsetMethod  = 'offset'
      var offsetBase    = 0
  
      this.offsets      = []
      this.targets      = []
      this.scrollHeight = this.getScrollHeight()
  
      if (!$.isWindow(this.$scrollElement[0])) {
        offsetMethod = 'position'
        offsetBase   = this.$scrollElement.scrollTop()
      }
  
      this.$body
        .find(this.selector)
        .map(function () {
          var $el   = $(this)
          var href  = $el.data('target') || $el.attr('href')
          var $href = /^#./.test(href) && $(href)
  
          return ($href
            && $href.length
            && $href.is(':visible')
            && [[$href[offsetMethod]().top + offsetBase, href]]) || null
        })
        .sort(function (a, b) { return a[0] - b[0] })
        .each(function () {
          that.offsets.push(this[0])
          that.targets.push(this[1])
        })
    }
  
    ScrollSpy.prototype.process = function () {
      var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
      var scrollHeight = this.getScrollHeight()
      var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()
      var offsets      = this.offsets
      var targets      = this.targets
      var activeTarget = this.activeTarget
      var i
  
      if (this.scrollHeight != scrollHeight) {
        this.refresh()
      }
  
      if (scrollTop >= maxScroll) {
        return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)
      }
  
      if (activeTarget && scrollTop < offsets[0]) {
        this.activeTarget = null
        return this.clear()
      }
  
      for (i = offsets.length; i--;) {
        activeTarget != targets[i]
          && scrollTop >= offsets[i]
          && (offsets[i + 1] === undefined || scrollTop < offsets[i + 1])
          && this.activate(targets[i])
      }
    }
  
    ScrollSpy.prototype.activate = function (target) {
      this.activeTarget = target
  
      this.clear()
  
      var selector = this.selector +
        '[data-target="' + target + '"],' +
        this.selector + '[href="' + target + '"]'
  
      var active = $(selector)
        .parents('li')
        .addClass('active')
  
      if (active.parent('.dropdown-menu').length) {
        active = active
          .closest('li.dropdown')
          .addClass('active')
      }
  
      active.trigger('activate.bs.scrollspy')
    }
  
    ScrollSpy.prototype.clear = function () {
      $(this.selector)
        .parentsUntil(this.options.target, '.active')
        .removeClass('active')
    }
  
  
    // SCROLLSPY PLUGIN DEFINITION
    // ===========================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.scrollspy')
        var options = typeof option == 'object' && option
  
        if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.scrollspy
  
    $.fn.scrollspy             = Plugin
    $.fn.scrollspy.Constructor = ScrollSpy
  
  
    // SCROLLSPY NO CONFLICT
    // =====================
  
    $.fn.scrollspy.noConflict = function () {
      $.fn.scrollspy = old
      return this
    }
  
  
    // SCROLLSPY DATA-API
    // ==================
  
    $(window).on('load.bs.scrollspy.data-api', function () {
      $('[data-spy="scroll"]').each(function () {
        var $spy = $(this)
        Plugin.call($spy, $spy.data())
      })
    })
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: tab.js v3.3.7
   * http://getbootstrap.com/javascript/#tabs
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // TAB CLASS DEFINITION
    // ====================
  
    var Tab = function (element) {
      // jscs:disable requireDollarBeforejQueryAssignment
      this.element = $(element)
      // jscs:enable requireDollarBeforejQueryAssignment
    }
  
    Tab.VERSION = '3.3.7'
  
    Tab.TRANSITION_DURATION = 150
  
    Tab.prototype.show = function () {
      var $this    = this.element
      var $ul      = $this.closest('ul:not(.dropdown-menu)')
      var selector = $this.data('target')
  
      if (!selector) {
        selector = $this.attr('href')
        selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
      }
  
      if ($this.parent('li').hasClass('active')) return
  
      var $previous = $ul.find('.active:last a')
      var hideEvent = $.Event('hide.bs.tab', {
        relatedTarget: $this[0]
      })
      var showEvent = $.Event('show.bs.tab', {
        relatedTarget: $previous[0]
      })
  
      $previous.trigger(hideEvent)
      $this.trigger(showEvent)
  
      if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) return
  
      var $target = $(selector)
  
      this.activate($this.closest('li'), $ul)
      this.activate($target, $target.parent(), function () {
        $previous.trigger({
          type: 'hidden.bs.tab',
          relatedTarget: $this[0]
        })
        $this.trigger({
          type: 'shown.bs.tab',
          relatedTarget: $previous[0]
        })
      })
    }
  
    Tab.prototype.activate = function (element, container, callback) {
      var $active    = container.find('> .active')
      var transition = callback
        && $.support.transition
        && ($active.length && $active.hasClass('fade') || !!container.find('> .fade').length)
  
      function next() {
        $active
          .removeClass('active')
          .find('> .dropdown-menu > .active')
            .removeClass('active')
          .end()
          .find('[data-toggle="tab"]')
            .attr('aria-expanded', false)
  
        element
          .addClass('active')
          .find('[data-toggle="tab"]')
            .attr('aria-expanded', true)
  
        if (transition) {
          element[0].offsetWidth // reflow for transition
          element.addClass('in')
        } else {
          element.removeClass('fade')
        }
  
        if (element.parent('.dropdown-menu').length) {
          element
            .closest('li.dropdown')
              .addClass('active')
            .end()
            .find('[data-toggle="tab"]')
              .attr('aria-expanded', true)
        }
  
        callback && callback()
      }
  
      $active.length && transition ?
        $active
          .one('bsTransitionEnd', next)
          .emulateTransitionEnd(Tab.TRANSITION_DURATION) :
        next()
  
      $active.removeClass('in')
    }
  
  
    // TAB PLUGIN DEFINITION
    // =====================
  
    function Plugin(option) {
      return this.each(function () {
        var $this = $(this)
        var data  = $this.data('bs.tab')
  
        if (!data) $this.data('bs.tab', (data = new Tab(this)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.tab
  
    $.fn.tab             = Plugin
    $.fn.tab.Constructor = Tab
  
  
    // TAB NO CONFLICT
    // ===============
  
    $.fn.tab.noConflict = function () {
      $.fn.tab = old
      return this
    }
  
  
    // TAB DATA-API
    // ============
  
    var clickHandler = function (e) {
      e.preventDefault()
      Plugin.call($(this), 'show')
    }
  
    $(document)
      .on('click.bs.tab.data-api', '[data-toggle="tab"]', clickHandler)
      .on('click.bs.tab.data-api', '[data-toggle="pill"]', clickHandler)
  
  }(jQuery);
  
  /* ========================================================================
   * Bootstrap: affix.js v3.3.7
   * http://getbootstrap.com/javascript/#affix
   * ========================================================================
   * Copyright 2011-2016 Twitter, Inc.
   * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
   * ======================================================================== */
  
  
  +function ($) {
    'use strict';
  
    // AFFIX CLASS DEFINITION
    // ======================
  
    var Affix = function (element, options) {
      this.options = $.extend({}, Affix.DEFAULTS, options)
  
      this.$target = $(this.options.target)
        .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
        .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))
  
      this.$element     = $(element)
      this.affixed      = null
      this.unpin        = null
      this.pinnedOffset = null
  
      this.checkPosition()
    }
  
    Affix.VERSION  = '3.3.7'
  
    Affix.RESET    = 'affix affix-top affix-bottom'
  
    Affix.DEFAULTS = {
      offset: 0,
      target: window
    }
  
    Affix.prototype.getState = function (scrollHeight, height, offsetTop, offsetBottom) {
      var scrollTop    = this.$target.scrollTop()
      var position     = this.$element.offset()
      var targetHeight = this.$target.height()
  
      if (offsetTop != null && this.affixed == 'top') return scrollTop < offsetTop ? 'top' : false
  
      if (this.affixed == 'bottom') {
        if (offsetTop != null) return (scrollTop + this.unpin <= position.top) ? false : 'bottom'
        return (scrollTop + targetHeight <= scrollHeight - offsetBottom) ? false : 'bottom'
      }
  
      var initializing   = this.affixed == null
      var colliderTop    = initializing ? scrollTop : position.top
      var colliderHeight = initializing ? targetHeight : height
  
      if (offsetTop != null && scrollTop <= offsetTop) return 'top'
      if (offsetBottom != null && (colliderTop + colliderHeight >= scrollHeight - offsetBottom)) return 'bottom'
  
      return false
    }
  
    Affix.prototype.getPinnedOffset = function () {
      if (this.pinnedOffset) return this.pinnedOffset
      this.$element.removeClass(Affix.RESET).addClass('affix')
      var scrollTop = this.$target.scrollTop()
      var position  = this.$element.offset()
      return (this.pinnedOffset = position.top - scrollTop)
    }
  
    Affix.prototype.checkPositionWithEventLoop = function () {
      setTimeout($.proxy(this.checkPosition, this), 1)
    }
  
    Affix.prototype.checkPosition = function () {
      if (!this.$element.is(':visible')) return
  
      var height       = this.$element.height()
      var offset       = this.options.offset
      var offsetTop    = offset.top
      var offsetBottom = offset.bottom
      var scrollHeight = Math.max($(document).height(), $(document.body).height())
  
      if (typeof offset != 'object')         offsetBottom = offsetTop = offset
      if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
      if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)
  
      var affix = this.getState(scrollHeight, height, offsetTop, offsetBottom)
  
      if (this.affixed != affix) {
        if (this.unpin != null) this.$element.css('top', '')
  
        var affixType = 'affix' + (affix ? '-' + affix : '')
        var e         = $.Event(affixType + '.bs.affix')
  
        this.$element.trigger(e)
  
        if (e.isDefaultPrevented()) return
  
        this.affixed = affix
        this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null
  
        this.$element
          .removeClass(Affix.RESET)
          .addClass(affixType)
          .trigger(affixType.replace('affix', 'affixed') + '.bs.affix')
      }
  
      if (affix == 'bottom') {
        this.$element.offset({
          top: scrollHeight - height - offsetBottom
        })
      }
    }
  
  
    // AFFIX PLUGIN DEFINITION
    // =======================
  
    function Plugin(option) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.affix')
        var options = typeof option == 'object' && option
  
        if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
        if (typeof option == 'string') data[option]()
      })
    }
  
    var old = $.fn.affix
  
    $.fn.affix             = Plugin
    $.fn.affix.Constructor = Affix
  
  
    // AFFIX NO CONFLICT
    // =================
  
    $.fn.affix.noConflict = function () {
      $.fn.affix = old
      return this
    }
  
  
    // AFFIX DATA-API
    // ==============
  
    $(window).on('load', function () {
      $('[data-spy="affix"]').each(function () {
        var $spy = $(this)
        var data = $spy.data()
  
        data.offset = data.offset || {}
  
        if (data.offsetBottom != null) data.offset.bottom = data.offsetBottom
        if (data.offsetTop    != null) data.offset.top    = data.offsetTop
  
        Plugin.call($spy, data)
      })
    })
  
  }(jQuery);;
  /**
  * jquery-match-height master by @liabru
  * http://brm.io/jquery-match-height/
  * License: MIT
  */
  
  ;(function(factory) { // eslint-disable-line no-extra-semi
      'use strict';
      if (typeof define === 'function' && define.amd) {
          // AMD
          define(['jquery'], factory);
      } else if (typeof module !== 'undefined' && module.exports) {
          // CommonJS
          module.exports = factory(require('jquery'));
      } else {
          // Global
          factory(jQuery);
      }
  })(function($) {
      /*
      *  internal
      */
  
      var _previousResizeWidth = -1,
          _updateTimeout = -1;
  
      /*
      *  _parse
      *  value parse utility function
      */
  
      var _parse = function(value) {
          // parse value and convert NaN to 0
          return parseFloat(value) || 0;
      };
  
      /*
      *  _rows
      *  utility function returns array of jQuery selections representing each row
      *  (as displayed after float wrapping applied by browser)
      */
  
      var _rows = function(elements) {
          var tolerance = 1,
              $elements = $(elements),
              lastTop = null,
              rows = [];
  
          // group elements by their top position
          $elements.each(function(){
              var $that = $(this),
                  top = $that.offset().top - _parse($that.css('margin-top')),
                  lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  
              if (lastRow === null) {
                  // first item on the row, so just push it
                  rows.push($that);
              } else {
                  // if the row top is the same, add to the row group
                  if (Math.floor(Math.abs(lastTop - top)) <= tolerance) {
                      rows[rows.length - 1] = lastRow.add($that);
                  } else {
                      // otherwise start a new row group
                      rows.push($that);
                  }
              }
  
              // keep track of the last row top
              lastTop = top;
          });
  
          return rows;
      };
  
      /*
      *  _parseOptions
      *  handle plugin options
      */
  
      var _parseOptions = function(options) {
          var opts = {
              byRow: true,
              property: 'height',
              target: null,
              remove: false
          };
  
          if (typeof options === 'object') {
              return $.extend(opts, options);
          }
  
          if (typeof options === 'boolean') {
              opts.byRow = options;
          } else if (options === 'remove') {
              opts.remove = true;
          }
  
          return opts;
      };
  
      /*
      *  matchHeight
      *  plugin definition
      */
  
      var matchHeight = $.fn.matchHeight = function(options) {
          var opts = _parseOptions(options);
  
          // handle remove
          if (opts.remove) {
              var that = this;
  
              // remove fixed height from all selected elements
              this.css(opts.property, '');
  
              // remove selected elements from all groups
              $.each(matchHeight._groups, function(key, group) {
                  group.elements = group.elements.not(that);
              });
  
              // TODO: cleanup empty groups
  
              return this;
          }
  
          if (this.length <= 1 && !opts.target) {
              return this;
          }
  
          // keep track of this group so we can re-apply later on load and resize events
          matchHeight._groups.push({
              elements: this,
              options: opts
          });
  
          // match each element's height to the tallest element in the selection
          matchHeight._apply(this, opts);
  
          return this;
      };
  
      /*
      *  plugin global options
      */
  
      matchHeight.version = 'master';
      matchHeight._groups = [];
      matchHeight._throttle = 80;
      matchHeight._maintainScroll = false;
      matchHeight._beforeUpdate = null;
      matchHeight._afterUpdate = null;
      matchHeight._rows = _rows;
      matchHeight._parse = _parse;
      matchHeight._parseOptions = _parseOptions;
  
      /*
      *  matchHeight._apply
      *  apply matchHeight to given elements
      */
  
      matchHeight._apply = function(elements, options) {
          var opts = _parseOptions(options),
              $elements = $(elements),
              rows = [$elements];
  
          // take note of scroll position
          var scrollTop = $(window).scrollTop(),
              htmlHeight = $('html').outerHeight(true);
  
          // get hidden parents
          var $hiddenParents = $elements.parents().filter(':hidden');
  
          // cache the original inline style
          $hiddenParents.each(function() {
              var $that = $(this);
              $that.data('style-cache', $that.attr('style'));
          });
  
          // temporarily must force hidden parents visible
          $hiddenParents.css('display', 'block');
  
          // get rows if using byRow, otherwise assume one row
          if (opts.byRow && !opts.target) {
  
              // must first force an arbitrary equal height so floating elements break evenly
              $elements.each(function() {
                  var $that = $(this),
                      display = $that.css('display');
  
                  // temporarily force a usable display value
                  if (display !== 'inline-block' && display !== 'flex' && display !== 'inline-flex') {
                      display = 'block';
                  }
  
                  // cache the original inline style
                  $that.data('style-cache', $that.attr('style'));
  
                  $that.css({
                      'display': display,
                      'padding-top': '0',
                      'padding-bottom': '0',
                      'margin-top': '0',
                      'margin-bottom': '0',
                      'border-top-width': '0',
                      'border-bottom-width': '0',
                      'height': '100px',
                      'overflow': 'hidden'
                  });
              });
  
              // get the array of rows (based on element top position)
              rows = _rows($elements);
  
              // revert original inline styles
              $elements.each(function() {
                  var $that = $(this);
                  $that.attr('style', $that.data('style-cache') || '');
              });
          }
  
          $.each(rows, function(key, row) {
              var $row = $(row),
                  targetHeight = 0;
  
              if (!opts.target) {
                  // skip apply to rows with only one item
                  if (opts.byRow && $row.length <= 1) {
                      $row.css(opts.property, '');
                      return;
                  }
  
                  // iterate the row and find the max height
                  $row.each(function(){
                      var $that = $(this),
                          style = $that.attr('style'),
                          display = $that.css('display');
  
                      // temporarily force a usable display value
                      if (display !== 'inline-block' && display !== 'flex' && display !== 'inline-flex') {
                          display = 'block';
                      }
  
                      // ensure we get the correct actual height (and not a previously set height value)
                      var css = { 'display': display };
                      css[opts.property] = '';
                      $that.css(css);
  
                      // find the max height (including padding, but not margin)
                      if ($that.outerHeight(false) > targetHeight) {
                          targetHeight = $that.outerHeight(false);
                      }
  
                      // revert styles
                      if (style) {
                          $that.attr('style', style);
                      } else {
                          $that.css('display', '');
                      }
                  });
              } else {
                  // if target set, use the height of the target element
                  targetHeight = opts.target.outerHeight(false);
              }
  
              // iterate the row and apply the height to all elements
              $row.each(function(){
                  var $that = $(this),
                      verticalPadding = 0;
  
                  // don't apply to a target
                  if (opts.target && $that.is(opts.target)) {
                      return;
                  }
  
                  // handle padding and border correctly (required when not using border-box)
                  if ($that.css('box-sizing') !== 'border-box') {
                      verticalPadding += _parse($that.css('border-top-width')) + _parse($that.css('border-bottom-width'));
                      verticalPadding += _parse($that.css('padding-top')) + _parse($that.css('padding-bottom'));
                  }
  
                  // set the height (accounting for padding and border)
                  $that.css(opts.property, (targetHeight - verticalPadding) + 'px');
              });
          });
  
          // revert hidden parents
          $hiddenParents.each(function() {
              var $that = $(this);
              $that.attr('style', $that.data('style-cache') || null);
          });
  
          // restore scroll position if enabled
          if (matchHeight._maintainScroll) {
              $(window).scrollTop((scrollTop / htmlHeight) * $('html').outerHeight(true));
          }
  
          return this;
      };
  
      /*
      *  matchHeight._applyDataApi
      *  applies matchHeight to all elements with a data-match-height attribute
      */
  
      matchHeight._applyDataApi = function() {
          var groups = {};
  
          // generate groups by their groupId set by elements using data-match-height
          $('[data-match-height], [data-mh]').each(function() {
              var $this = $(this),
                  groupId = $this.attr('data-mh') || $this.attr('data-match-height');
  
              if (groupId in groups) {
                  groups[groupId] = groups[groupId].add($this);
              } else {
                  groups[groupId] = $this;
              }
          });
  
          // apply matchHeight to each group
          $.each(groups, function() {
              this.matchHeight(true);
          });
      };
  
      /*
      *  matchHeight._update
      *  updates matchHeight on all current groups with their correct options
      */
  
      var _update = function(event) {
          if (matchHeight._beforeUpdate) {
              matchHeight._beforeUpdate(event, matchHeight._groups);
          }
  
          $.each(matchHeight._groups, function() {
              matchHeight._apply(this.elements, this.options);
          });
  
          if (matchHeight._afterUpdate) {
              matchHeight._afterUpdate(event, matchHeight._groups);
          }
      };
  
      matchHeight._update = function(throttle, event) {
          // prevent update if fired from a resize event
          // where the viewport width hasn't actually changed
          // fixes an event looping bug in IE8
          if (event && event.type === 'resize') {
              var windowWidth = $(window).width();
              if (windowWidth === _previousResizeWidth) {
                  return;
              }
              _previousResizeWidth = windowWidth;
          }
  
          // throttle updates
          if (!throttle) {
              _update(event);
          } else if (_updateTimeout === -1) {
              _updateTimeout = setTimeout(function() {
                  _update(event);
                  _updateTimeout = -1;
              }, matchHeight._throttle);
          }
      };
  
      /*
      *  bind events
      */
  
      // apply on DOM ready event
      $(matchHeight._applyDataApi);
  
      // update heights on load and resize events
      $(window).bind('load', function(event) {
          matchHeight._update(false, event);
      });
  
      // throttled update heights on resize events
      $(window).bind('resize orientationchange', function(event) {
          matchHeight._update(true, event);
      });
  
  });
  
  
  /*!
   * jQuery blockUI plugin
   * Version 2.70.0-2014.11.23
   * Requires jQuery v1.7 or later
   *
   * Examples at: http://malsup.com/jquery/block/
   * Copyright (c) 2007-2013 M. Alsup
   * Dual licensed under the MIT and GPL licenses:
   * http://www.opensource.org/licenses/mit-license.php
   * http://www.gnu.org/licenses/gpl.html
   *
   * Thanks to Amir-Hossein Sobhi for some excellent contributions!
   */
  ;(function() {
  /*jshint eqeqeq:false curly:false latedef:false */
  "use strict";
  
      function setup($) {
          $.fn._fadeIn = $.fn.fadeIn;
  
          var noOp = $.noop || function() {};
  
          // this bit is to ensure we don't call setExpression when we shouldn't (with extra muscle to handle
          // confusing userAgent strings on Vista)
          var msie = /MSIE/.test(navigator.userAgent);
          var ie6  = /MSIE 6.0/.test(navigator.userAgent) && ! /MSIE 8.0/.test(navigator.userAgent);
          var mode = document.documentMode || 0;
          var setExpr = $.isFunction( document.createElement('div').style.setExpression );
  
          // global $ methods for blocking/unblocking the entire page
          $.blockUI   = function(opts) { install(window, opts); };
          $.unblockUI = function(opts) { remove(window, opts); };
  
          // convenience method for quick growl-like notifications  (http://www.google.com/search?q=growl)
          $.growlUI = function(title, message, timeout, onClose) {
              var $m = $('<div class="growlUI"></div>');
              if (title) $m.append('<h1>'+title+'</h1>');
              if (message) $m.append('<h2>'+message+'</h2>');
              if (timeout === undefined) timeout = 3000;
  
              // Added by konapun: Set timeout to 30 seconds if this growl is moused over, like normal toast notifications
              var callBlock = function(opts) {
                  opts = opts || {};
  
                  $.blockUI({
                      message: $m,
                      fadeIn : typeof opts.fadeIn  !== 'undefined' ? opts.fadeIn  : 700,
                      fadeOut: typeof opts.fadeOut !== 'undefined' ? opts.fadeOut : 1000,
                      timeout: typeof opts.timeout !== 'undefined' ? opts.timeout : timeout,
                      centerY: false,
                      showOverlay: false,
                      onUnblock: onClose,
                      css: $.blockUI.defaults.growlCSS
                  });
              };
  
              callBlock();
              var nonmousedOpacity = $m.css('opacity');
              $m.mouseover(function() {
                  callBlock({
                      fadeIn: 0,
                      timeout: 30000
                  });
  
                  var displayBlock = $('.blockMsg');
                  displayBlock.stop(); // cancel fadeout if it has started
                  displayBlock.fadeTo(300, 1); // make it easier to read the message by removing transparency
              }).mouseout(function() {
                  $('.blockMsg').fadeOut(1000);
              });
              // End konapun additions
          };
  
          // plugin method for blocking element content
          $.fn.block = function(opts) {
              if ( this[0] === window ) {
                  $.blockUI( opts );
                  return this;
              }
              var fullOpts = $.extend({}, $.blockUI.defaults, opts || {});
              this.each(function() {
                  var $el = $(this);
                  if (fullOpts.ignoreIfBlocked && $el.data('blockUI.isBlocked'))
                      return;
                  $el.unblock({ fadeOut: 0 });
              });
  
              return this.each(function() {
                  if ($.css(this,'position') == 'static') {
                      this.style.position = 'relative';
                      $(this).data('blockUI.static', true);
                  }
                  this.style.zoom = 1; // force 'hasLayout' in ie
                  install(this, opts);
              });
          };
  
          // plugin method for unblocking element content
          $.fn.unblock = function(opts) {
              if ( this[0] === window ) {
                  $.unblockUI( opts );
                  return this;
              }
              return this.each(function() {
                  remove(this, opts);
              });
          };
  
          $.blockUI.version = 2.70; // 2nd generation blocking at no extra cost!
  
          // override these in your code to change the default behavior and style
          $.blockUI.defaults = {
              // message displayed when blocking (use null for no message)
              message:  '<h1>Please wait...</h1>',
  
              title: null,        // title string; only used when theme == true
              draggable: true,    // only used when theme == true (requires jquery-ui.js to be loaded)
  
              theme: false, // set to true to use with jQuery UI themes
  
              // styles for the message when blocking; if you wish to disable
              // these and use an external stylesheet then do this in your code:
              // $.blockUI.defaults.css = {};
              css: {
                  padding:    0,
                  margin:     0,
                  width:      '30%',
                  top:        '40%',
                  left:       '35%',
                  textAlign:  'center',
                  color:      '#000',
                  border:     '3px solid #aaa',
                  backgroundColor:'#fff',
                  cursor:     'wait'
              },
  
              // minimal style set used when themes are used
              themedCSS: {
                  width:  '30%',
                  top:    '40%',
                  left:   '35%'
              },
  
              // styles for the overlay
              overlayCSS:  {
                  backgroundColor:    '#000',
                  opacity:            0.6,
                  cursor:             'wait'
              },
  
              // style to replace wait cursor before unblocking to correct issue
              // of lingering wait cursor
              cursorReset: 'default',
  
              // styles applied when using $.growlUI
              growlCSS: {
                  width:      '350px',
                  top:        '10px',
                  left:       '',
                  right:      '10px',
                  border:     'none',
                  padding:    '5px',
                  opacity:    0.6,
                  cursor:     'default',
                  color:      '#fff',
                  backgroundColor: '#000',
                  '-webkit-border-radius':'10px',
                  '-moz-border-radius':   '10px',
                  'border-radius':        '10px'
              },
  
              // IE issues: 'about:blank' fails on HTTPS and javascript:false is s-l-o-w
              // (hat tip to Jorge H. N. de Vasconcelos)
              /*jshint scripturl:true */
              iframeSrc: /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank',
  
              // force usage of iframe in non-IE browsers (handy for blocking applets)
              forceIframe: false,
  
              // z-index for the blocking overlay
              baseZ: 1000,
  
              // set these to true to have the message automatically centered
              centerX: true, // <-- only effects element blocking (page block controlled via css above)
              centerY: true,
  
              // allow body element to be stetched in ie6; this makes blocking look better
              // on "short" pages.  disable if you wish to prevent changes to the body height
              allowBodyStretch: true,
  
              // enable if you want key and mouse events to be disabled for content that is blocked
              bindEvents: true,
  
              // be default blockUI will supress tab navigation from leaving blocking content
              // (if bindEvents is true)
              constrainTabKey: true,
  
              // fadeIn time in millis; set to 0 to disable fadeIn on block
              fadeIn:  200,
  
              // fadeOut time in millis; set to 0 to disable fadeOut on unblock
              fadeOut:  400,
  
              // time in millis to wait before auto-unblocking; set to 0 to disable auto-unblock
              timeout: 0,
  
              // disable if you don't want to show the overlay
              showOverlay: true,
  
              // if true, focus will be placed in the first available input field when
              // page blocking
              focusInput: true,
  
              // elements that can receive focus
              focusableElements: ':input:enabled:visible',
  
              // suppresses the use of overlay styles on FF/Linux (due to performance issues with opacity)
              // no longer needed in 2012
              // applyPlatformOpacityRules: true,
  
              // callback method invoked when fadeIn has completed and blocking message is visible
              onBlock: null,
  
              // callback method invoked when unblocking has completed; the callback is
              // passed the element that has been unblocked (which is the window object for page
              // blocks) and the options that were passed to the unblock call:
              //  onUnblock(element, options)
              onUnblock: null,
  
              // callback method invoked when the overlay area is clicked.
              // setting this will turn the cursor to a pointer, otherwise cursor defined in overlayCss will be used.
              onOverlayClick: null,
  
              // don't ask; if you really must know: http://groups.google.com/group/jquery-en/browse_thread/thread/36640a8730503595/2f6a79a77a78e493#2f6a79a77a78e493
              quirksmodeOffsetHack: 4,
  
              // class name of the message block
              blockMsgClass: 'blockMsg',
  
              // if it is already blocked, then ignore it (don't unblock and reblock)
              ignoreIfBlocked: false
          };
  
          // private data and functions follow...
  
          var pageBlock = null;
          var pageBlockEls = [];
  
          function install(el, opts) {
              var css, themedCSS;
              var full = (el == window);
              var msg = (opts && opts.message !== undefined ? opts.message : undefined);
              opts = $.extend({}, $.blockUI.defaults, opts || {});
  
              if (opts.ignoreIfBlocked && $(el).data('blockUI.isBlocked'))
                  return;
  
              opts.overlayCSS = $.extend({}, $.blockUI.defaults.overlayCSS, opts.overlayCSS || {});
              css = $.extend({}, $.blockUI.defaults.css, opts.css || {});
              if (opts.onOverlayClick)
                  opts.overlayCSS.cursor = 'pointer';
  
              themedCSS = $.extend({}, $.blockUI.defaults.themedCSS, opts.themedCSS || {});
              msg = msg === undefined ? opts.message : msg;
  
              // remove the current block (if there is one)
              if (full && pageBlock)
                  remove(window, {fadeOut:0});
  
              // if an existing element is being used as the blocking content then we capture
              // its current place in the DOM (and current display style) so we can restore
              // it when we unblock
              if (msg && typeof msg != 'string' && (msg.parentNode || msg.jquery)) {
                  var node = msg.jquery ? msg[0] : msg;
                  var data = {};
                  $(el).data('blockUI.history', data);
                  data.el = node;
                  data.parent = node.parentNode;
                  data.display = node.style.display;
                  data.position = node.style.position;
                  if (data.parent)
                      data.parent.removeChild(node);
              }
  
              $(el).data('blockUI.onUnblock', opts.onUnblock);
              var z = opts.baseZ;
  
              // blockUI uses 3 layers for blocking, for simplicity they are all used on every platform;
              // layer1 is the iframe layer which is used to supress bleed through of underlying content
              // layer2 is the overlay layer which has opacity and a wait cursor (by default)
              // layer3 is the message content that is displayed while blocking
              var lyr1, lyr2, lyr3, s;
              if (msie || opts.forceIframe)
                  lyr1 = $('<iframe class="blockUI" style="z-index:'+ (z++) +';display:none;border:none;margin:0;padding:0;position:absolute;width:100%;height:100%;top:0;left:0" src="'+opts.iframeSrc+'"></iframe>');
              else
                  lyr1 = $('<div class="blockUI" style="display:none"></div>');
  
              if (opts.theme)
                  lyr2 = $('<div class="blockUI blockOverlay ui-widget-overlay" style="z-index:'+ (z++) +';display:none"></div>');
              else
                  lyr2 = $('<div class="blockUI blockOverlay" style="z-index:'+ (z++) +';display:none;border:none;margin:0;padding:0;width:100%;height:100%;top:0;left:0"></div>');
  
              if (opts.theme && full) {
                  s = '<div class="blockUI ' + opts.blockMsgClass + ' blockPage ui-dialog ui-widget ui-corner-all" style="z-index:'+(z+10)+';display:none;position:fixed">';
                  if ( opts.title ) {
                      s += '<div class="ui-widget-header ui-dialog-titlebar ui-corner-all blockTitle">'+(opts.title || '&nbsp;')+'</div>';
                  }
                  s += '<div class="ui-widget-content ui-dialog-content"></div>';
                  s += '</div>';
              }
              else if (opts.theme) {
                  s = '<div class="blockUI ' + opts.blockMsgClass + ' blockElement ui-dialog ui-widget ui-corner-all" style="z-index:'+(z+10)+';display:none;position:absolute">';
                  if ( opts.title ) {
                      s += '<div class="ui-widget-header ui-dialog-titlebar ui-corner-all blockTitle">'+(opts.title || '&nbsp;')+'</div>';
                  }
                  s += '<div class="ui-widget-content ui-dialog-content"></div>';
                  s += '</div>';
              }
              else if (full) {
                  s = '<div class="blockUI ' + opts.blockMsgClass + ' blockPage" style="z-index:'+(z+10)+';display:none;position:fixed"></div>';
              }
              else {
                  s = '<div class="blockUI ' + opts.blockMsgClass + ' blockElement" style="z-index:'+(z+10)+';display:none;position:absolute"></div>';
              }
              lyr3 = $(s);
  
              // if we have a message, style it
              if (msg) {
                  if (opts.theme) {
                      lyr3.css(themedCSS);
                      lyr3.addClass('ui-widget-content');
                  }
                  else
                      lyr3.css(css);
              }
  
              // style the overlay
              if (!opts.theme /*&& (!opts.applyPlatformOpacityRules)*/)
                  lyr2.css(opts.overlayCSS);
              lyr2.css('position', full ? 'fixed' : 'absolute');
  
              // make iframe layer transparent in IE
              if (msie || opts.forceIframe)
                  lyr1.css('opacity',0.0);
  
              //$([lyr1[0],lyr2[0],lyr3[0]]).appendTo(full ? 'body' : el);
              var layers = [lyr1,lyr2,lyr3], $par = full ? $('body') : $(el);
              $.each(layers, function() {
                  this.appendTo($par);
              });
  
              if (opts.theme && opts.draggable && $.fn.draggable) {
                  lyr3.draggable({
                      handle: '.ui-dialog-titlebar',
                      cancel: 'li'
                  });
              }
  
              // ie7 must use absolute positioning in quirks mode and to account for activex issues (when scrolling)
              var expr = setExpr && (!$.support.boxModel || $('object,embed', full ? null : el).length > 0);
              if (ie6 || expr) {
                  // give body 100% height
                  if (full && opts.allowBodyStretch && $.support.boxModel)
                      $('html,body').css('height','100%');
  
                  // fix ie6 issue when blocked element has a border width
                  if ((ie6 || !$.support.boxModel) && !full) {
                      var t = sz(el,'borderTopWidth'), l = sz(el,'borderLeftWidth');
                      var fixT = t ? '(0 - '+t+')' : 0;
                      var fixL = l ? '(0 - '+l+')' : 0;
                  }
  
                  // simulate fixed position
                  $.each(layers, function(i,o) {
                      var s = o[0].style;
                      s.position = 'absolute';
                      if (i < 2) {
                          if (full)
                              s.setExpression('height','Math.max(document.body.scrollHeight, document.body.offsetHeight) - (jQuery.support.boxModel?0:'+opts.quirksmodeOffsetHack+') + "px"');
                          else
                              s.setExpression('height','this.parentNode.offsetHeight + "px"');
                          if (full)
                              s.setExpression('width','jQuery.support.boxModel && document.documentElement.clientWidth || document.body.clientWidth + "px"');
                          else
                              s.setExpression('width','this.parentNode.offsetWidth + "px"');
                          if (fixL) s.setExpression('left', fixL);
                          if (fixT) s.setExpression('top', fixT);
                      }
                      else if (opts.centerY) {
                          if (full) s.setExpression('top','(document.documentElement.clientHeight || document.body.clientHeight) / 2 - (this.offsetHeight / 2) + (blah = document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop) + "px"');
                          s.marginTop = 0;
                      }
                      else if (!opts.centerY && full) {
                          var top = (opts.css && opts.css.top) ? parseInt(opts.css.top, 10) : 0;
                          var expression = '((document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop) + '+top+') + "px"';
                          s.setExpression('top',expression);
                      }
                  });
              }
  
              // show the message
              if (msg) {
                  if (opts.theme)
                      lyr3.find('.ui-widget-content').append(msg);
                  else
                      lyr3.append(msg);
                  if (msg.jquery || msg.nodeType)
                      $(msg).show();
              }
  
              if ((msie || opts.forceIframe) && opts.showOverlay)
                  lyr1.show(); // opacity is zero
              if (opts.fadeIn) {
                  var cb = opts.onBlock ? opts.onBlock : noOp;
                  var cb1 = (opts.showOverlay && !msg) ? cb : noOp;
                  var cb2 = msg ? cb : noOp;
                  if (opts.showOverlay)
                      lyr2._fadeIn(opts.fadeIn, cb1);
                  if (msg)
                      lyr3._fadeIn(opts.fadeIn, cb2);
              }
              else {
                  if (opts.showOverlay)
                      lyr2.show();
                  if (msg)
                      lyr3.show();
                  if (opts.onBlock)
                      opts.onBlock.bind(lyr3)();
              }
  
              // bind key and mouse events
              bind(1, el, opts);
  
              if (full) {
                  pageBlock = lyr3[0];
                  pageBlockEls = $(opts.focusableElements,pageBlock);
                  if (opts.focusInput)
                      setTimeout(focus, 20);
              }
              else
                  center(lyr3[0], opts.centerX, opts.centerY);
  
              if (opts.timeout) {
                  // auto-unblock
                  var to = setTimeout(function() {
                      if (full)
                          $.unblockUI(opts);
                      else
                          $(el).unblock(opts);
                  }, opts.timeout);
                  $(el).data('blockUI.timeout', to);
              }
          }
  
          // remove the block
          function remove(el, opts) {
              var count;
              var full = (el == window);
              var $el = $(el);
              var data = $el.data('blockUI.history');
              var to = $el.data('blockUI.timeout');
              if (to) {
                  clearTimeout(to);
                  $el.removeData('blockUI.timeout');
              }
              opts = $.extend({}, $.blockUI.defaults, opts || {});
              bind(0, el, opts); // unbind events
  
              if (opts.onUnblock === null) {
                  opts.onUnblock = $el.data('blockUI.onUnblock');
                  $el.removeData('blockUI.onUnblock');
              }
  
              var els;
              if (full) // crazy selector to handle odd field errors in ie6/7
                  els = $(document.body).children().filter('.blockUI').add('body > .blockUI');
              else
                  els = $el.find('>.blockUI');
  
              // fix cursor issue
              if ( opts.cursorReset ) {
                  if ( els.length > 1 )
                      els[1].style.cursor = opts.cursorReset;
                  if ( els.length > 2 )
                      els[2].style.cursor = opts.cursorReset;
              }
  
              if (full)
                  pageBlock = pageBlockEls = null;
  
              if (opts.fadeOut) {
                  count = els.length;
                  els.stop().fadeOut(opts.fadeOut, function() {
                      if ( --count === 0)
                          reset(els,data,opts,el);
                  });
              }
              else
                  reset(els, data, opts, el);
          }
  
          // move blocking element back into the DOM where it started
          function reset(els,data,opts,el) {
              var $el = $(el);
              if ( $el.data('blockUI.isBlocked') )
                  return;
  
              els.each(function(i,o) {
                  // remove via DOM calls so we don't lose event handlers
                  if (this.parentNode)
                      this.parentNode.removeChild(this);
              });
  
              if (data && data.el) {
                  data.el.style.display = data.display;
                  data.el.style.position = data.position;
                  data.el.style.cursor = 'default'; // #59
                  if (data.parent)
                      data.parent.appendChild(data.el);
                  $el.removeData('blockUI.history');
              }
  
              if ($el.data('blockUI.static')) {
                  $el.css('position', 'static'); // #22
              }
  
              if (typeof opts.onUnblock == 'function')
                  opts.onUnblock(el,opts);
  
              // fix issue in Safari 6 where block artifacts remain until reflow
              var body = $(document.body), w = body.width(), cssW = body[0].style.width;
              body.width(w-1).width(w);
              body[0].style.width = cssW;
          }
  
          // bind/unbind the handler
          function bind(b, el, opts) {
              var full = el == window, $el = $(el);
  
              // don't bother unbinding if there is nothing to unbind
              if (!b && (full && !pageBlock || !full && !$el.data('blockUI.isBlocked')))
                  return;
  
              $el.data('blockUI.isBlocked', b);
  
              // don't bind events when overlay is not in use or if bindEvents is false
              if (!full || !opts.bindEvents || (b && !opts.showOverlay))
                  return;
  
              // bind anchors and inputs for mouse and key events
              var events = 'mousedown mouseup keydown keypress keyup touchstart touchend touchmove';
              if (b)
                  $(document).bind(events, opts, handler);
              else
                  $(document).unbind(events, handler);
  
          // former impl...
          //      var $e = $('a,:input');
          //      b ? $e.bind(events, opts, handler) : $e.unbind(events, handler);
          }
  
          // event handler to suppress keyboard/mouse events when blocking
          function handler(e) {
              // allow tab navigation (conditionally)
              if (e.type === 'keydown' && e.keyCode && e.keyCode == 9) {
                  if (pageBlock && e.data.constrainTabKey) {
                      var els = pageBlockEls;
                      var fwd = !e.shiftKey && e.target === els[els.length-1];
                      var back = e.shiftKey && e.target === els[0];
                      if (fwd || back) {
                          setTimeout(function(){focus(back);},10);
                          return false;
                      }
                  }
              }
              var opts = e.data;
              var target = $(e.target);
              if (target.hasClass('blockOverlay') && opts.onOverlayClick)
                  opts.onOverlayClick(e);
  
              // allow events within the message content
              if (target.parents('div.' + opts.blockMsgClass).length > 0)
                  return true;
  
              // allow events for content that is not being blocked
              return target.parents().children().filter('div.blockUI').length === 0;
          }
  
          function focus(back) {
              if (!pageBlockEls)
                  return;
              var e = pageBlockEls[back===true ? pageBlockEls.length-1 : 0];
              if (e)
                  e.focus();
          }
  
          function center(el, x, y) {
              var p = el.parentNode, s = el.style;
              var l = ((p.offsetWidth - el.offsetWidth)/2) - sz(p,'borderLeftWidth');
              var t = ((p.offsetHeight - el.offsetHeight)/2) - sz(p,'borderTopWidth');
              if (x) s.left = l > 0 ? (l+'px') : '0';
              if (y) s.top  = t > 0 ? (t+'px') : '0';
          }
  
          function sz(el, p) {
              return parseInt($.css(el,p),10)||0;
          }
  
      }
  
  
      /*global define:true */
      if (typeof define === 'function' && define.amd && define.amd.jQuery) {
          define(['jquery'], setup);
      } else {
          setup(jQuery);
      }
  
  })();
  
  /**
   * jQuery.marquee - scrolling text like old marquee element
   * @author Aamir Afridi - aamirafridi(at)gmail(dot)com / http://aamirafridi.com/jquery/jquery-marquee-plugin
   */
  (function(f){f.fn.marquee=function(x){return this.each(function(){var a=f.extend({},f.fn.marquee.defaults,x),b=f(this),c,h,t,u,k,e=3,y="animation-play-state",n=!1,E=function(a,b,c){for(var e=["webkit","moz","MS","o",""],d=0;d<e.length;d++)e[d]||(b=b.toLowerCase()),a.addEventListener(e[d]+b,c,!1)},F=function(a){var b=[],c;for(c in a)a.hasOwnProperty(c)&&b.push(c+":"+a[c]);b.push();return"{"+b.join(",")+"}"},p={pause:function(){n&&a.allowCss3Support?c.css(y,"paused"):f.fn.pause&&c.pause();b.data("runningStatus",
  "paused");b.trigger("paused")},resume:function(){n&&a.allowCss3Support?c.css(y,"running"):f.fn.resume&&c.resume();b.data("runningStatus","resumed");b.trigger("resumed")},toggle:function(){p["resumed"==b.data("runningStatus")?"pause":"resume"]()},destroy:function(){clearTimeout(b.timer);b.find("*").andSelf().unbind();b.html(b.find(".js-marquee:first").html())}};if("string"===typeof x)f.isFunction(p[x])&&(c||(c=b.find(".js-marquee-wrapper")),!0===b.data("css3AnimationIsSupported")&&(n=!0),p[x]());else{var v;
  f.each(a,function(c,d){v=b.attr("data-"+c);if("undefined"!==typeof v){switch(v){case "true":v=!0;break;case "false":v=!1}a[c]=v}});a.speed&&(a.duration=a.speed*parseInt(b.width(),10));u="up"==a.direction||"down"==a.direction;a.gap=a.duplicated?parseInt(a.gap):0;b.wrapInner('<div class="js-marquee"></div>');var l=b.find(".js-marquee").css({"margin-right":a.gap,"float":"left"});a.duplicated&&l.clone(!0).appendTo(b);b.wrapInner('<div style="width:100000px" class="js-marquee-wrapper"></div>');c=b.find(".js-marquee-wrapper");
  if(u){var m=b.height();c.removeAttr("style");b.height(m);b.find(".js-marquee").css({"float":"none","margin-bottom":a.gap,"margin-right":0});a.duplicated&&b.find(".js-marquee:last").css({"margin-bottom":0});var q=b.find(".js-marquee:first").height()+a.gap;a.startVisible&&!a.duplicated?(a._completeDuration=(parseInt(q,10)+parseInt(m,10))/parseInt(m,10)*a.duration,a.duration*=parseInt(q,10)/parseInt(m,10)):a.duration*=(parseInt(q,10)+parseInt(m,10))/parseInt(m,10)}else k=b.find(".js-marquee:first").width()+
  a.gap,h=b.width(),a.startVisible&&!a.duplicated?(a._completeDuration=(parseInt(k,10)+parseInt(h,10))/parseInt(h,10)*a.duration,a.duration*=parseInt(k,10)/parseInt(h,10)):a.duration*=(parseInt(k,10)+parseInt(h,10))/parseInt(h,10);a.duplicated&&(a.duration/=2);if(a.allowCss3Support){var l=document.body||document.createElement("div"),g="marqueeAnimation-"+Math.floor(1E7*Math.random()),A=["Webkit","Moz","O","ms","Khtml"],B="animation",d="",r="";l.style.animation&&(r="@keyframes "+g+" ",n=!0);if(!1===
  n)for(var z=0;z<A.length;z++)if(void 0!==l.style[A[z]+"AnimationName"]){l="-"+A[z].toLowerCase()+"-";B=l+B;y=l+y;r="@"+l+"keyframes "+g+" ";n=!0;break}n&&(d=g+" "+a.duration/1E3+"s "+a.delayBeforeStart/1E3+"s infinite "+a.css3easing,b.data("css3AnimationIsSupported",!0))}var C=function(){c.css("margin-top","up"==a.direction?m+"px":"-"+q+"px")},D=function(){c.css("margin-left","left"==a.direction?h+"px":"-"+k+"px")};a.duplicated?(u?a.startVisible?c.css("margin-top",0):c.css("margin-top","up"==a.direction?
  m+"px":"-"+(2*q-a.gap)+"px"):a.startVisible?c.css("margin-left",0):c.css("margin-left","left"==a.direction?h+"px":"-"+(2*k-a.gap)+"px"),a.startVisible||(e=1)):a.startVisible?e=2:u?C():D();var w=function(){a.duplicated&&(1===e?(a._originalDuration=a.duration,a.duration=u?"up"==a.direction?a.duration+m/(q/a.duration):2*a.duration:"left"==a.direction?a.duration+h/(k/a.duration):2*a.duration,d&&(d=g+" "+a.duration/1E3+"s "+a.delayBeforeStart/1E3+"s "+a.css3easing),e++):2===e&&(a.duration=a._originalDuration,
  d&&(g+="0",r=f.trim(r)+"0 ",d=g+" "+a.duration/1E3+"s 0s infinite "+a.css3easing),e++));u?a.duplicated?(2<e&&c.css("margin-top","up"==a.direction?0:"-"+q+"px"),t={"margin-top":"up"==a.direction?"-"+q+"px":0}):a.startVisible?2===e?(d&&(d=g+" "+a.duration/1E3+"s "+a.delayBeforeStart/1E3+"s "+a.css3easing),t={"margin-top":"up"==a.direction?"-"+q+"px":m+"px"},e++):3===e&&(a.duration=a._completeDuration,d&&(g+="0",r=f.trim(r)+"0 ",d=g+" "+a.duration/1E3+"s 0s infinite "+a.css3easing),C()):(C(),t={"margin-top":"up"==
  a.direction?"-"+c.height()+"px":m+"px"}):a.duplicated?(2<e&&c.css("margin-left","left"==a.direction?0:"-"+k+"px"),t={"margin-left":"left"==a.direction?"-"+k+"px":0}):a.startVisible?2===e?(d&&(d=g+" "+a.duration/1E3+"s "+a.delayBeforeStart/1E3+"s "+a.css3easing),t={"margin-left":"left"==a.direction?"-"+k+"px":h+"px"},e++):3===e&&(a.duration=a._completeDuration,d&&(g+="0",r=f.trim(r)+"0 ",d=g+" "+a.duration/1E3+"s 0s infinite "+a.css3easing),D()):(D(),t={"margin-left":"left"==a.direction?"-"+k+"px":
  h+"px"});b.trigger("beforeStarting");if(n){c.css(B,d);var l=r+" { 100%  "+F(t)+"}",p=c.find("style");0!==p.length?p.filter(":last").html(l):c.append("<style>"+l+"</style>");E(c[0],"AnimationIteration",function(){b.trigger("finished")});E(c[0],"AnimationEnd",function(){w();b.trigger("finished")})}else c.animate(t,a.duration,a.easing,function(){b.trigger("finished");a.pauseOnCycle?b.timer=setTimeout(w,a.delayBeforeStart):w()});b.data("runningStatus","resumed")};b.bind("pause",p.pause);b.bind("resume",
  p.resume);a.pauseOnHover&&b.bind("mouseenter mouseleave",p.toggle);n&&a.allowCss3Support?w():b.timer=setTimeout(w,a.delayBeforeStart)}})};f.fn.marquee.defaults={allowCss3Support:!0,css3easing:"linear",easing:"linear",delayBeforeStart:1E3,direction:"left",duplicated:!1,duration:5E3,gap:20,pauseOnCycle:!1,pauseOnHover:!1,startVisible:!1}})(jQuery);
  ;
  (function () {
      if (window.addtocalendar)if(typeof window.addtocalendar.start == "function")return;
      if (window.ifaddtocalendar == undefined) { window.ifaddtocalendar = 1;
          var d = document, s = d.createElement('script'), g = 'getElementsByTagName';
          s.type = 'text/javascript';s.charset = 'UTF-8';s.async = true;
          s.src = '/sites/default/files/js-lib/atc.min.js';
          var h = d[g]('body')[0];h.appendChild(s);
      }
  })();;
  (function( $ ) {
  
      $.fn.readMore = function(options) {
  
          var settings = $.extend({
              numberOfLines : 5,
              endingTag : '&hellip;'
          }, options );
  
          function getWidth(pre_space, str, post_space, append_elem){
              var pre = (pre_space) ? '&nbsp;' : '';
              var post = (post_space) ? '&nbsp;' : '';
  
              var tmp_div = $('<span style="white-space: nowrap;">'+pre+str+post+'</span>');
              append_elem.append(tmp_div);
              var width =  tmp_div.width();
              tmp_div.remove();
              return width;
          }
  
          return this.each(function() {
              //debugger;
              var width = $(this).width();
              var text = this.innerText;
              var words = text.split(' ');
              var line_width = 0;
              var current_line = '';
              var lines = [];
              var endingTagWidth = getWidth(false, settings.endingTag, false, $(this));
              for (index = 0;  index < words.length; index++) {
                  var word = words[index];
                  if(line_width == 0){
                      line_width += getWidth(false, word, false, $(this));
                  }
                  else {
                      line_width += getWidth(true, word, false, $(this));
                  }
  
                  if((lines.length + 1 == settings.numberOfLines && line_width > width - endingTagWidth) || (line_width  > width)){
                      lines.push(current_line);
  
                      if (lines.length == settings.numberOfLines) {
                          lines[settings.numberOfLines-1] = lines[settings.numberOfLines-1] + settings.endingTag;
                          break;
                      }
  
                      line_width = getWidth(false, word, false, $(this)); // new line
                      current_line = '';
                  }
                  current_line += ((current_line != '') ? ' ' : '') + word;
  
                  if(index == (words.length-1)){
                      lines.push(current_line);
                      lines[settings.numberOfLines-1] = lines[settings.numberOfLines-1];
                  }
  
              }
              this.innerHTML = lines.join(' ');
          })
  
      };
  
  }( jQuery ));;
  