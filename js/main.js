 var Editor = function() {
    var getHardRandomInt = function() {
        var max = 1000000,
            min =  0;
        return Math.floor(Math.random() * (max - min)) + min;
    };

    var composeRandId = function() {
        return '' + $.now() + '-' + getHardRandomInt();
    };

    // todo extract History class
    var undoStore = null,
        redoStore = null,
        undoManager = new UndoManager();
    
    var clearHistory = function() {
        undoStore = [];
        redoStore = [];
        undoManager.clear();
    };

    clearHistory();
    
    var createHistoryPoint = function() {
        var layout = $('#canvas').html();
        undoStore.push(layout);
        clearRedoStore();
        undoManager.add({ undo: undo, redo: redo });
    };
    
    var clearRedoStore = function() {
        redoStore = [];  
    };
    
    var toggle = function($el, pred) {
        if(pred()) {
            $el.removeAttr('disabled');
        } else {
            $el.attr('disabled', 'disabled');
        }
    };

    var undoRedoOnOff = function() {
        toggle($('.undo-button'), undoManager.hasUndo);
        toggle($('.redo-button'), undoManager.hasRedo);
    };

    undoManager.setCallback(undoRedoOnOff);
    
    var undo = function() {
        var prevSnapshot = undoStore.pop();
        var curSnapshot = $('#canvas').html();
        redoStore.push(curSnapshot);
        $('#canvas').html(prevSnapshot);
        
        $(document).trigger('domChanged'); // todo run in Q promise?
    };
    
    var redo = function() {
        var nextSnapshot = redoStore.pop();
        var curSnapshot = $('#canvas').html();
        undoStore.push(curSnapshot);
        $('#canvas').html(nextSnapshot);
        
        $(document).trigger('domChanged'); // todo run in Q promise?
    };

    var btnRemoveClick = function() {
        createHistoryPoint();
        
        var $buttonRemove = $(this);
        var $parent = $buttonRemove.closest('.row');
        $parent.detach();
        
        $(document).trigger('domChanged');
    };

    // no need to off, it's outside canvas
    $(document).on('click', '.undo-button', undoManager.undo);
    $(document).on('click', '.redo-button', undoManager.redo);
    
    // todo refactor duplicates & names in uploaders

    var attachFileUploader = function($fileUploadInput, $img) {
        var embedImg = function(e) {
            // <img src="data:image/png; base64, iVBORw0...
            $img.attr('src', e.target.result);
            $(document).trigger('domChanged');
        };
        
        $fileUploadInput.embedImg = embedImg;
        $fileUploadInput.imageUpload = function(element) {
            var reader = new FileReader();
            reader.onload = $fileUploadInput.embedImg;
            reader.readAsDataURL(element.files[0]);
        };
        
        $fileUploadInput.change(function() {
            $fileUploadInput.imageUpload(this);
        });
    };
    
    var attachBackgroundFileUploader = function($fileUploadInput) {
        var embedImg = function(e) {
            // background-image: url(data:image/png; base64, iVBORw0...);
            $('#pseudo-body').css('background-image', 'url(' + e.target.result + ')');
            $(document).trigger('domChanged');
        };
        
        $fileUploadInput.embedImg = embedImg;
        $fileUploadInput.imageUpload = function(element) {
            var reader = new FileReader();
            reader.onload = $fileUploadInput.embedImg;
            reader.readAsDataURL(element.files[0]);
        };
        
        $fileUploadInput.change(function() {
            $fileUploadInput.imageUpload(this);
        });
    };

    var buildImgUploaders = function($items) {
        $items.each(function(_, itm) {
            var $item = $(itm);
            var $fileUploadInput = $item.find('input');
            var $fileUploadLabel = $item.find('label');

            var newFSId = 'img-upload-' + composeRandId();
            $fileUploadLabel.attr('for', newFSId);
            $fileUploadInput.attr('id', newFSId);
            
            var $img = $item.find('img');
            attachFileUploader($fileUploadInput, $img);
        });
    };
    
    var buildBackgroundFileUploaders = function($items) {
        $items.each(function(_, itm) {
            var $item = $(itm);
            var $fileUploadInput = $item.find('input');
            var $fileUploadLabel = $item.find('label');

            var newFSId = 'img-upload-' + composeRandId();
            $fileUploadLabel.attr('for', newFSId);
            $fileUploadInput.attr('id', newFSId);
            
            attachBackgroundFileUploader($fileUploadInput);
        });
    };

    return {
        clearHistory: clearHistory,
        createRemoveButtons: function(context) {
            $('.button-remove-wrap', context).html(
                '<label class="btn btn-danger button-remove">Удалить</label>');
        },
        createReplaceButtons: function(context) {
            $('.button-replace-wrap', context).html(
                '<label class="button-replace-img btn btn-default" for="my-file-selector"><input id="my-file-selector" style="display:none;" type="file"/>Заменить</label>');
            
            $('.button-replace-background-wrap', context).html(
                '<label class="button-replace-background-img btn btn-default" for="my-file-selector"><input id="my-file-selector" style="display:none;" type="file"/>Заменить фон</label> <button type="button" class="button-remove-background-img btn btn-default">Удалить фон</button>');
        },
        removeBackgroundImgButtonInit: function() {
            $(document).off('click', '.button-remove-background-img');

            $(document).on('click', '.button-remove-background-img', function() {
                $('#pseudo-body').css('background-image', '');
                $(this).blur();
                $(document).trigger('domChanged');
            });
        },
        handleButtonsCreate: function(context) {
            $('.button-handle-wrap', context).html(
                '<label class="btn btn-default button-handle">Схватить</label>');
        },
        handleButtonsOn: function() {
            $(document).on('mousedown', '.button-handle', function() {
                createHistoryPoint();
                $(document).one('mousemove', '.button-handle', function() { // note "one" here
                    $(this).text('Отпусти');
                });
            });
            
            $(document).on('mouseup', '.button-handle', function() {
                $(this).text('Схватить');
                $(this).closest('.hover-mark').removeClass('seize-highlight');
            });
        },
        handleButtonsOff: function() {
            $(document).off('mousedown', '.button-handle');
            $(document).off('mouseup', '.button-handle');
            $(document).off('mousemove', '.button-handle');
        },
        hoverMarkOn: function() {
            $( document ).on( 'mouseenter', '.hover-mark', function() {
                $(this).find('.button-remove').show();
                $(this).find('.button-replace-img').show();
                $(this).find('.button-handle').show();
                $(this).find('.map-panel').show();
                $(this).find('.video-panel').show();
            });

            $( document ).on( 'mouseleave', '.hover-mark', function() {
// todo call hide all before save
                $(this).find('.button-remove').hide();
                $(this).find('.button-replace-img').hide();
                $(this).find('.button-handle').hide();
                $(this).find('.map-panel').hide();
                $(this).find('.video-panel').hide();
            });
        },
        hoverMarkOff: function() {
            $(document).off( 'mouseenter', '.hover-mark');
            $(document).off( 'mouseleave', '.hover-mark');
        },
        initSortable: function() {
            $( '.sortable' ).sortable({
                //delay: 150, for touch punch
                scroll: true,
                scrollSensitivity: 150,
                handle: '.button-handle',
                cancel: '.button-remove,.button-replace-img,.map-url,.video-url',
                placeholder: 'ui-state-highlight',
                tolerance:   'pointer',
                start: function( e, ui ) {
                    $(ui.item).closest('.hover-mark').removeClass('seize-highlight');

                    $( '.ui-state-highlight' )
                         .width( ui.item.width() )
                         .height( ui.item.height() );
                },
                stop: function() {
                    
                },
                update: function(e, ui) {
                    $(document).trigger('domChanged');
                    // should not fire domChanged here, 'cause "stop" fires it
                },
                receive : function(e, ui) {
                    var droppedEl = $(this).data().uiSortable.currentItem;

                    droppedEl.children('.dummy').remove();

                    var $block = droppedEl.children().first(); // row
                    $block.removeClass( 'hidden-el' );

                    buildImgUploaders($('.item', $block)); // todo lol item:)

                    droppedEl.replaceWith($block);
                    
                    var carouselId = composeRandId();
                    $('.carousel', $block).attr('id', carouselId);
                    $('.carousel ol li', $block).attr('data-target', '#' + carouselId);
                    $('.carousel a', $block).attr('href', '#' + carouselId);
                    
                    // should not fire 'domChanged' here too, 'cause "stop" fires it
                    
                    return true;
                }
            });
        },
        initContentEditable: function() { // todo may do nothing, delete?
            $(document).off( 'click', '.content-editable');
            $(document).off( 'blur', '.content-editable');
            
            $( document ).on( 'click', '.content-editable', function() {
                $( this ).prop( 'contentEditable', true );
                $( this ).focus();
            });

            $( document ).on( 'blur', '.content-editable', function() {
                $(document).trigger('domChanged');
            });
        },
        initButtonRemove: function() {
            $(document).off('click', '.button-remove');
            $(document).on( 'click', '.button-remove', btnRemoveClick);
        },
        initDraggable: function() {
            $( '.draggable' ).draggable({
                connectToSortable: '.sortable',
                helper: 'clone',
                revert: 'invalid',
                revertDuration: 50,
                start: function(ev, ui) {
                    var $helper = $( ui.helper );
                    $helper.removeClass('btn btn-default');
                    $helper.children('.dummy').remove();
                    $helper.children().removeClass( 'hidden-el' );

                    $helper
                        .width( $('.container.sortable').width() )
                        .height( $helper.children('.row.hover-mark').height() );
                },
                drag: function(ev, ui) {
                    var $helper = $('.ui-draggable-dragging');
                    // todo remove copypaste
                    $( '.ui-state-highlight' )
                        .width( $helper.width())
                        .height( $helper.height() )
                        .css( 'line-height', $helper.height() + 'px' );
                }
            });
        },
        initFileUpload: function() {
            var $templateImgUploaders = $('.item', '.container');
            buildImgUploaders($templateImgUploaders);
            
            var $backgroundFileUploaders = $('.item2', '.palette');
            buildBackgroundFileUploaders($backgroundFileUploaders);
        },
        paletteOn: function() {
          $( document ).on( 'mouseenter', '#studio-navbar', function() {
              $('#palette').hide();
          });

          $( document ).on( 'mouseleave', '#studio-navbar', function() {
              $('#palette').show();
          });
        },
        paletteOff: function() {
          $( document ).off( 'mouseenter', '#studio-navbar');
          $( document ).off( 'mouseleave', '#studio-navbar');
        },
        mapUrlKeyUpInit: function() {
            $(document).off('keyup', '.map-url');
            $(document).off('blur', '.map-url');
            
            $(document).on('keyup', '.map-url', function() {
                var $mapUrl = $(this);
                $mapUrl.text($mapUrl.val());
                var encodedAddress = encodeURI($mapUrl.val());
                var url = 'http://maps.googleapis.com/maps/api/staticmap?center=' + encodedAddress +  '&zoom=12&scale=2&size=600x350&maptype=roadmap&format=png&visual_refresh=true&markers=%7Ccolor:red%7Clabel:.%7C' + encodedAddress;
                var $mapImg = $mapUrl.closest('.map').find('img');
                $mapImg.attr('src', url);
                $mapImg.attr('alt', $mapUrl.val() + ' на карте Гугла');
            });
            
            $(document).on('blur', '.map-url', function() {
                $(document).trigger('domChanged');
            });
        },
        videoCodeKeyUpInit: function() {
            $(document).off('keyup', '.video-url');
            $(document).off('blur', '.video-url');
            
            $(document).on('keyup', '.video-url', function() {
                var $videoUrl = $(this);
                $videoUrl.text($videoUrl.val());
                var $videoEmbed = $videoUrl.closest('.video').find('iframe');
                $videoEmbed.attr('src', 'https://www.youtube.com/embed/' + $videoUrl.val());
            });
            
            $(document).on('blur', '.video-url', function() {
                $(document).trigger('domChanged');
            });
        }
    };
};

// escape 'event' word
// todo lint it

// console.log();
// debugger
// undefined
// JSON.stringify