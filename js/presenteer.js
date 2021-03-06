/**
* Presenteer class
* @author Willem Mulder
*
* Note: don't use element-rotates of 90 or 270 degrees in combination with element-translates. 
* A bug in the Sylvester matrix libs will set the horizontal translation to 0 when you do this
*/
function Presenteer(canvas, elements, options) {
	/*
	* Initialize
	*/
	var canvas = $(canvas);
	if (canvas.size() == 0) {
		return false;
	}
	// Set transform-origin to top-left
	setTransformOrigin(canvas, 0, 0);
	var canvasZoomFactor = 1;
	var originalElements = elements;
	var elements = []; // Array of elements to show, in order
	$.each(originalElements, function(index,element) {
		if (element.nodeType == 1) { 
			// Element is a raw HTML element. We build our 'own' element which references the raw HTML element
			elements.push({ "element" : $(element) });
		} else if (typeof(element) == "string") {
			// Element is a selector. We build our 'own' element, referencing the selected element
			elements.push({ "element" : $(element) });
		} else { 
			// We assume that element is an object that is already in 'our' style (see below)
			elements.push(element);
		}
	});
	var currentIndex = -1;
	var prevIndex = -1;
	var fullScreenSupport = document.documentElement.requestFullScreen || document.documentElement.mozRequestFullScreen || document.documentElement.webkitRequestFullScreen || document.documentElement.oRequestFullScreen;
	var isFullScreen = false;
	var realign = function() { setTimeout(function() { show(elements[currentIndex]); }, 10); }
	document.addEventListener("mozfullscreenchange", function() { if (typeof(mozFullScreenElement) == "undefined") { isFullScreen = false; }; realign(); });
	document.addEventListener("webkitfullscreenchange", function() { if (typeof(webkitFullScreenElement) == "undefined") { isFullScreen = false; }; realign(); });
	document.addEventListener("ofullscreenchange", function() { if (typeof(oFullScreenElement) == "undefined") { isFullScreen = false; }; realign(); });
	$(document).on("keyup", function(event) {
		// On an escape, leave fullScreen
		if (event.which == "27") {
			cancelFullScreen();
			realign();
		}
	});
	var fullScreenElement;
	var fullScreenBackupStyling;
	
	/*
	* Options
	*/
	// Loop over given options and set a default if an option is not specified
	var optionDefaults = { 
		showOriginalMargins : false, 
		//showCustomMargin : false, 
		//customMarginWidth : 20,
		centerHorizontally : true,
		centerVertically : true,
		followElementTransforms: true,
		transition: {
			"transition-delay" : "0s",
			"transition-duration" : "0.5s",
			"transition-property" : "all",
			"transition-timing-function" : "ease"
		},
		useExistingTransitionIfAvailable: true, // Will not work for Opera and IE
		// Callbacks
		onBeforeEnter : function(elm) {},
		onAfterEnter : function(elm) {},
		onBeforeLeave : function(elm) {},
		onAfterLeave : function(elm) {}
	};
	if (typeof(options) != "object") {
		options = {};
	}
	for (index in optionDefaults) {
		// If an option is not given in the constructor, set the default value
		if (typeof(options[index]) == "undefined") {
			options[index] = optionDefaults[index];
		}
	}
	
	/*
	* Main function to show an element
	* Takes into account element transforms
	*/
	function show(elm) {
		var e = $(elm.element);
		
		// Temporarily disable transitions while we change things around
		// Opera and IE9 cannot get transitions properties via Javascript, See http://my.opera.com/community/forums/topic.dml?id=1145422
		var transitionsBackup = getTransitions(canvas);
		setTransitions(canvas,{});
		var transitionsElmBackup = getTransitions(e);
		setTransitions(e,{});
		
		// Reset canvas transformations
		var transformationBackup = getTransformation(canvas);
		setTransformation(canvas, "none");
		
		// Reset element's transformations to ensure we can calculate the transform-origin correctly
		// We assume the origin is at the center of the element, and for that, we need a left, top and a height and width. 
		// However, those values are only reliable for non-transformed elements.
		// That is, for transformed elements, position().left and position().top will return their actual transformed state,
		// but .width() and .height() will return the original *non-transformed* width and height, making it impossible to calculate a transformed transform-origin.
		var elementTransformationBackup = getTransformation(e);
		setTransformation(e, "none");
		
		canvasZoomFactor = 1;
		var baseLeft = e.offset().left  - canvas.offset().left;
		var baseTop = e.offset().top  - canvas.offset().top;
		
		// Calculate new zoom
		var canvasWidth = canvas.outerWidth(options.showOriginalMargins);
		var canvasHeight = canvas.outerHeight(options.showOriginalMargins);
		var viewportWidth = canvas.parent().outerWidth();
		var viewportHeight = canvas.parent().outerHeight();
		var proportionalWidth = e.outerWidth(options.showOriginalMargins) / viewportWidth; // e.g. 200/1000 = 0.2
		var proportionalHeight = e.outerHeight(options.showOriginalMargins) / viewportHeight;
		var scaleFactor = Math.max(proportionalWidth, proportionalHeight);
		canvasZoomFactor = (1 / scaleFactor); // e.g. zoom to (1 / (0.2)) = 5
		// Move element. At first, always move the element to top-left of the canvas
		var newLeft = ((baseLeft - (e.outerWidth(options.showOriginalMargins) * (canvasZoomFactor-1) / 2)) * -1);
		var newTop = ((baseTop - (e.outerHeight(options.showOriginalMargins) * (canvasZoomFactor-1) / 2)) * -1);
		if (proportionalWidth > proportionalHeight) {
			// Element will take full Width, leaving space at top and bottom
			if (options.centerVertically) {
				var openSpace = viewportHeight - (e.outerHeight(options.showOriginalMargins)*canvasZoomFactor);
				newTop += (openSpace / 2);
			}
		} else {
			// Element will take full Height, leaving space left and right
			if (options.centerHorizontally) {
				var openSpace = viewportWidth - (e.outerWidth(options.showOriginalMargins)*canvasZoomFactor);
				newLeft += (openSpace / 2);
			}
		}
		// If canvas is smaller than its container, then center the canvas in its parent
		if (options.centerVertically && (outerScrollHeight(canvas, options.showOriginalMargins) * canvasZoomFactor) < viewportHeight) {
			// This does not work on Webkit for some reason. $(canvas).outerHeight() seems to always return 0
			if (!$.browser.webkit && !$.browser.opera) {
				newTop = (viewportHeight - (outerScrollHeight(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
			}
		}
		if (options.centerHorizontally && (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)  < viewportWidth) {
			// This does not work on Webkit for some reason. $(canvas).outerWidth() seems to always return 0
			if (!$.browser.webkit && !$.browser.opera) {
				//newLeft = (viewportWidth - (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
			}
		}
		
		// Calculate new transform Origin
		var transformOriginLeft = (Math.round((baseLeft * 1 + (e.outerWidth() / 2))*10000)/10000) + "px";
		var transformOriginTop = (Math.round((baseTop * 1 + (e.outerHeight() / 2))*10000)/10000) + "px";
		
		// Set transformations back to how they were
		setTransformation(canvas, transformationBackup);
		setTransformation(e, elementTransformationBackup);

		// Do a setTimeOut to prevent Webkit from tripping up and starting all transitions from xy 0px,0px
		setTimeout(function() {
			// Enable transitions again
			// Set canvas-transition to either a) existing transition or b) transition as given in parameter
			var canvasTransitionString = getTransitionString(transitionsBackup);
			if (canvasTransitionString != "" && options.useExistingTransitionIfAvailable) {
				setTransitions(canvas, transitionsBackup);
			} else {
				setTransitions(canvas, options.transition);
			}
			setTransitions(e, transitionsElmBackup);
			// Set canvas transformations to correct values
			var inverseMatrix = (options.followElementTransforms ? processElementTransforms(e) : "");
			var transform =  ' translate('+(Math.round(newLeft*10000)/10000)+'px,'+(Math.round(newTop*10000)/10000)+'px)  scale('+(Math.round(canvasZoomFactor*10000)/10000)+') ' + inverseMatrix;
			setTransformOrigin(canvas, transformOriginLeft, transformOriginTop);
			setTransformation(canvas,transform);
		}, 1);
	}
	
	var prefixes = { moz : "Moz", webkit : "Webkit", o : "O", ms : "ms", all : "" };
	
	function getTransitions(e) {
		var ret = {};
		var elm = $(e);
		
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			var p = ret[prefixID] = {};
			p["transition-delay"] = elm.css(prefix + "TransitionDelay");
			p["transition-duration"] = elm.css(prefix + "TransitionDuration");
			p["transition-property"] = elm.css(prefix + "TransitionProperty");
			p["transition-timing-function"] = elm.css(prefix + "TransitionTimingFunction");
		}
		return ret;
	}
	
	function setTransitions(e, transitions) {
		var elm = $(e);
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			var transitionElms = transitions[prefixID] || {};
			elm.css(prefix+"TransitionDelay", transitionElms["transition-delay"] || transitions["transition-delay"] || "0s");
			elm.css(prefix+"TransitionDuration", transitionElms["transition-duration"] || transitions["transition-duration"] || "0s");
			elm.css(prefix+"TransitionProperty", transitionElms["transition-property"] || transitions["transition-property"] || "none");
			elm.css(prefix+"TransitionTimingFunction", transitionElms["transition-timing-function"] || transitions["transition-timing-function"] || "");
		}
	}
	
	function getTransitionString(transitions) {
		for (var prefixID in transitions) {
			var p = transitions[prefixID];
			var transitionIsInThisPrefix = false;
			if (
				p["transition-duration"] != "" 
				&& p["transition-duration"] != "0" 
				&& p["transition-duration"] != "0s"
				&& p["transition-duration"] != null)
			{
				return p["transition-property"] + " " + p["transition-duration"] + " " + p["transition-timing-function"];
			}
		}
		return "";
	}
	
	function setTransformOrigin(elm, left, top) {
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			$(elm).css(prefix+"TransformOrigin",left+" "+top); 
		}
	}
	
	function getTransformation(elm) {
		return $(elm).get(0).style.WebkitTransform || $(elm).get(0).style.MozTransform || $(elm).get(0).style.OTransform || $(elm).get(0).style.msTransform || $(elm).get(0).style.transform ||  "";
	}
	
	function setTransformation(elm, transform) {
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			$(elm).css(prefix+"Transform", transform);
		}
	}
	
	function addTransformation(elm, transform) {
		$(elm).get(0).style.MozTransform += transform;
		$(elm).get(0).style.WebkitTransform += transform;
		$(elm).get(0).style.OTransform += transform;
		$(elm).get(0).style.msTransform += transform;
		$(elm).get(0).style.transform += transform;
	}
	
	function processElementTransforms(elm) {
		// Copy the inverse of the element transforms to the canvas
		var matrix = "";
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			if ($(elm).css(prefix+"Transform") != null && $(elm).css(prefix+"Transform").indexOf("matrix") === 0) {
				var matrix = $(elm).css(prefix+"Transform");
				break;
			}
		}
		if (matrix != "") {
			// Calculate the inverse
			// Or work with the raw elements via matrix.substr(7, matrix.length - 8).split(', ');
			var sylvesterMatrixString = matrix.replace(/matrix\((.+)\, (.+)\, (.+)\, (.+)\, (.+?)p?x?\, (.+?)p?x?\)/, "\$M([[$1,$3,$5],[$2,$4,$6],[0,0,1]])");
			var sylvesterMatrix = eval(sylvesterMatrixString);
			var inverseMatrix = sylvesterMatrix.inverse();
			// .e(row,column), 1-based
			var inverseMatrixString = "";
			if (inverseMatrix != null) {
				inverseMatrixString = "matrix(" 
					+ Math.round(inverseMatrix.e(1,1)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(2,1)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(1,2)*100000000)/100000000 + ", "
					+ Math.round(inverseMatrix.e(2,2)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(1,3)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(2,3)*100000000)/100000000 + ""
				+ ")";
			}
			// Return inverse
			return inverseMatrixString;
		}
		return "";
	}
		
	/*
	* Helper functions to calculate the outerScrollHeight/Width of elements
	*/
	function outerScrollHeight(elm, includeMargin) {
		// When an element's content does not generate a vertical scrollbar, then its scrollHeight property is equal to its clientHeight property.
        // https://developer.mozilla.org/en/DOM/element.scrollHeight
		if ($.browser.mozilla || $.browser.opera) {
			var heightWithoutScrollbars = $(elm).get(0).scrollHeight;
			var originalOverflowStyle = $(elm).get(0).style.overflow;
			$(elm).get(0).style.overflow = "scroll";
		}
		var totalHeight = $(elm).get(0).scrollHeight; // Includes padding.
		if ($.browser.mozilla || $.browser.opera) {
			if (heightWithoutScrollbars > totalHeight) {
				// Then the added scrollbars have caused the element to be smaller, which we will have to ignore
				totalHeight = heightWithoutScrollbars;
			}
			$(elm).get(0).style.overflow = originalOverflowStyle;
		}
		totalHeight = totalHeight + ($(elm).outerHeight(includeMargin) - $(elm).innerHeight());
		return totalHeight;
	}
	
	function outerScrollWidth(elm, includeMargin) {
		// When an element's content does not generate a horizontal scrollbar, then its scrollWidth property is equal to its clientWidth property.
        // https://developer.mozilla.org/en/DOM/element.scrollWidth
		if ($.browser.mozilla || $.browser.opera) {
			var widthWithoutScrollbars = $(elm).get(0).scrollWidth;
			var originalOverflowStyle = $(elm).get(0).style.overflow;
			$(elm).get(0).style.overflow = "scroll";
		}
		var totalWidth = $(elm).get(0).scrollWidth; // Includes padding
		if ($.browser.mozilla || $.browser.opera) {
			if (widthWithoutScrollbars > totalWidth) {
				// Then the added scrollbars have caused the element to be smaller, which we will have to ignore
				totalWidth = widthWithoutScrollbars;
			}
			$(elm).get(0).style.overflow = originalOverflowStyle;
		}
		totalWidth += $(elm).outerWidth(includeMargin) - $(elm).innerWidth();
		return totalWidth;
	}
	
	function toggleFullScreen(elm) {  
		if (isFullScreen === false) {
			if (typeof(elm) == "undefined") {
				var elm = $(canvas).parent().get(0);
			}
			fullScreen();
		} else {  
			cancelFullScreen();
		}  
    }
	
	function fullScreen(elm) {
		if (typeof(elm) == "undefined") {
			fullScreenElement = $(canvas).parent().get(0);
		} else {
			fullScreenElement = $(elm).get(0);
		}
		if (fullScreenSupport) {
			if (fullScreenElement.requestFullScreen) {
				fullScreenElement.requestFullScreen();
			} else if (fullScreenElement.mozRequestFullScreen) {
				fullScreenElement.mozRequestFullScreen();
				fullScreenElement.mozfullscreenerror = function() { isFullScreen = false; return; }
			} else if (fullScreenElement.webkitRequestFullScreen) {  
				fullScreenElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
			} else if (fullScreenElement.oRequestFullScreen) {  
				fullScreenElement.oRequestFullScreen();
			}
		} else {
			// Set black background
			$("body").append("<div id='presenteerjsfullscreenbackground' style='position: fixed; background: #000; left: 0px; top: 0px; right: 0px; bottom: 0px;'></div>");
			// Set element to full-screen
			fullScreenBackupStyling = $(fullScreenElement).attr("style");
			$(fullScreenElement).attr("style", fullScreenBackupStyling + "; position: fixed; z-index: 1000; left: 0px; top: 0px; right: 0px; bottom: 0px;");
		}
		isFullScreen = true;
	}
	
	function cancelFullScreen() {
		if (fullScreenSupport) {
			if (document.cancelFullScreen) {  
			  document.cancelFullScreen();  
			} else if (document.mozCancelFullScreen) {  
			  document.mozCancelFullScreen();  
			} else if (document.webkitCancelFullScreen) {  
			  document.webkitCancelFullScreen();  
			} else if (document.oCancelFullScreen) {  
			  document.oCancelFullScreen();  
			}
		} else {
			// Remove black background
			$("#presenteerjsfullscreenbackground").remove();
			// Set element to normal style
			$(fullScreenElement).attr("style", (fullScreenBackupStyling||""));
		}
		isFullScreen = false;
	}
	
	/*
	* The facade for the 'outer world' to work with
	*/
	return {
		start : function() {
			currentIndex = 0;
			this.showCurrent();
		},
		restart : function() {
			prevIndex = currentIndex;
			currentIndex = 0;
			this.showCurrent();
		},
		show : function(index) {
			prevIndex = currentIndex;
			currentIndex = index;
			this.showCurrent();
		},
		next : function() {
			prevIndex = currentIndex;
			currentIndex++;
			if (currentIndex > elements.length-1) {
				currentIndex = 0;
			}
			this.showCurrent();
		},
		prev : function() {
			prevIndex = currentIndex;
			currentIndex--;
			if (currentIndex < 0) {
				currentIndex = elements.length-1;
			}
			this.showCurrent();
		},
		previous : function() {
			this.prev();
		},
		showCurrent : function() {
			// Forward-moving 'before' callbacks
			if (prevIndex < currentIndex) {
				if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeaveToNext) == "function") {
					elements[prevIndex].onBeforeLeaveToNext();
				}
				if (typeof(elements[currentIndex].onBeforeEnterFromPrev) == "function") {
					elements[currentIndex].onBeforeEnterFromPrev();
				}
			}
			// Backward-moving 'before' callbacks
			if (prevIndex > currentIndex) {
				if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeaveToPrev) == "function") {
					elements[prevIndex].onBeforeLeaveToPrev();
				}
				if (typeof(elements[currentIndex].onBeforeEnterFromNext) == "function") {
					elements[currentIndex].onBeforeEnterFromNext();
				}
			}
			// All-direction 'before' callbacks
			if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeave) == "function") {
				elements[prevIndex].onBeforeLeave();
			}
			if (typeof(elements[currentIndex].onBeforeEnter) == "function") {
				elements[currentIndex].onBeforeEnter();
			}
			// General callbacks
			if (elements[prevIndex]) { options.onBeforeLeave(elements[prevIndex]); }
			options.onBeforeEnter(elements[currentIndex]);
			
			// Show element
			show(elements[currentIndex]);
			
			// Forward-moving 'after' callbacks
			if (prevIndex < currentIndex) {
				if (elements[prevIndex] && typeof(elements[prevIndex].onAfterLeaveToNext) == "function") {
					elements[prevIndex].onAfterLeaveToNext();
				}
				if (typeof(elements[currentIndex].onAfterEnterFromPrev) == "function") {
					elements[currentIndex].onAfterEnterFromPrev();
				}
			}
			// Backward-moving 'after' callbacks
			if (prevIndex > currentIndex) {
				if (typeof(elements[prevIndex].onAfterLeaveToPrev) == "function") {
					elements[prevIndex].onAfterLeaveToPrev();
				}
				if (typeof(elements[currentIndex].onAfterEnterFromNext) == "function") {
					elements[currentIndex].onAfterEnterFromNext();
				}
			}
			// All-direction 'after' callbacks
			if (elements[prevIndex] && typeof(elements[prevIndex].onAfterLeave) == "function") {
				elements[prevIndex].onAfterLeave();
			}
			if (typeof(elements[currentIndex].onAfterEnter) == "function") {
				elements[currentIndex].onAfterEnter();
			}
			// General callbacks
			if (elements[prevIndex]) { options.onAfterLeave(elements[prevIndex]); }
			options.onAfterEnter(elements[currentIndex]);
		},
		getCanvas : function() {
			return $(canvas);
		},
		
		getCurrentIndex : function() {
			return currentIndex;
		},
		getPrevIndex : function() {
			return prevIndex;
		},
		
		toggleFullScreen : function(elm) {
			toggleFullScreen(elm);
			show(elements[currentIndex]);
		},
		fullScreen : function(elm) {
			fullScreen(elm);
			show(elements[currentIndex]);
		},
		cancelFullScreen : function() {
			cancelFullScreen();
			show(elements[currentIndex]);
		},
		isFullScreen : function() {
			return isFullScreen;
		}
		
	};
}
