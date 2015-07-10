(function(){
    var firebase = null;
    if (window.location.hostname === "verstaler.ml") {
        firebase = new Firebase("https://ibochy.firebaseio.com");
    } else {
        firebase = new Firebase("https://ibochy-test.firebaseio.com");
    }
    
    var editor = new Editor();
    
    var editorTabOn = function() {
        $('#editorControls').show();
        $('#tabs a[href="#editor"]').tab('show');
        $('#palette').show();
        editor.paletteOn();
    };
    
    var mySitesTabOn = function() {
        editor.paletteOff();
        $('#palette').hide();
        $('#editorControls').hide();
        $('#tabs a[href="#mysites"]').tab('show');
    };
    
    var ibochyStudio = angular.module('ibochyStudio', ["firebase"]);

    ibochyStudio.controller('UserController', [
        '$rootScope', '$scope', '$firebaseAuth', '$firebaseArray', '$timeout',
        function($rootScope, $scope, $firebaseAuth, $firebaseArray, $timeout) {
            $scope.auth = $firebaseAuth(firebase);
            $scope.siteName = null; // todo dirty
            
            $scope.mySitesTabOn = function() {
                mySitesTabOn();

                // todo editor off while 'My sites' is active
            };

            $scope.authData = $scope.auth.$getAuth();
            if ($scope.authData) {
                $scope.staff = {}; // staff is author
                $scope.staff.email = $scope.authData.password.email;
                $timeout(function() { // dirty, but works only
                    $rootScope.$broadcast('bindSites', {});
                    
                    mySitesTabOn(); // todo should keep active tab between reloads
                });
            } else {
                editorTabOn();
            } 
            
            $scope.auth.$onAuth(function(authData) {
                $scope.authData = authData;
            });

            $scope.loginStaff = function(staff) {
                $('#login-btn').attr('disabled', 'disabled'); //todo ng-dis
                    // todo show progress
                $scope.auth.$authWithPassword({
                    email    : staff.email,
                    password : staff.password
                }).then(function(authData) {
                    $scope.staff.password = '';
                    
                    $rootScope.$broadcast('bindSites', {});
                    
                    mySitesTabOn();
                    
                    var author = firebase.child('authors/' + authData.uid);
                    author.update({
                        last_seen_at: Firebase.ServerValue.TIMESTAMP
                    });
                }).catch(function(error) {
                    alert("Login Failed!", error);
                    $('#login-btn').removeAttr('disabled');
                });
            };
            
            $scope.editorTabOn = function() {
               editorTabOn();
            };

            $scope.saveSite = function() {
                $scope.$broadcast('saveSite', {});
            };

            $scope.logoutStaff = function(staff) {
                $scope.auth.$unauth();
                $scope.staff = {};
                
                $rootScope.$broadcast('clearSites', {});
                $rootScope.$broadcast('logout', {});
                
                $('#login-btn').removeAttr('disabled');
                $('#save-site-btn').attr('disabled', 'disabled');

                editorTabOn();
                
                // todo clear undo-redo
            };
        }]);

    // todo it's just rerun of Editor's funcs
    var resetEditor = function(editor) {
        editor.createRemoveButtons('#palette');
        editor.createReplaceButtons('#palette');
        
        editor.removeBackgroundImgButtonInit();
        
        editor.createRemoveButtons('#canvas');
        editor.createReplaceButtons('#canvas');
        
        editor.handleButtonsOff();
        editor.handleButtonsCreate('#palette');
        editor.handleButtonsCreate('#canvas');
        editor.handleButtonsOn();

        editor.hoverMarkOff();
        editor.hoverMarkOn();
        
        editor.initContentEditable();

        editor.initButtonRemove();
        editor.initSortable();

        editor.initDraggable();
        editor.initFileUpload();
        
        editor.mapUrlKeyUpInit();
        
        editor.videoCodeKeyUpInit();
    };

    ibochyStudio.controller('TemplateController', ['$scope',
        function($scope) {
            $scope.layoutId = null; // todo bad smell: local state
            var currentLayoutRef = null; // todo bad smell: local state 2
            var bindLayout = function(layout_id) {
                $scope.layoutId = layout_id;
                currentLayoutRef = firebase.child('layouts/' + layout_id);
                currentLayoutRef.on( // on is live is danger
                    'value', 
                    function(data) {
                        $('#canvas').html(data.val().doc); // it's layout.doc
                        resetEditor(editor);
                    });
                // todo off while on 'My Sites'
            };
            
            var bindDemoLayout = function(e, args) {
                bindLayout('_0022');
                $scope.$parent.siteName = null;
            };
            
            bindDemoLayout();

            $scope.$on('openInEditor', function(e, site) {
                if (currentLayoutRef) { 
                    currentLayoutRef.off('value');
                }
                bindLayout(site.layout_id);
                
                editorTabOn();
                
                $('#save-site-btn').removeAttr('disabled');
                
                $scope.$parent.siteName = site.name; // todo stale after editing name
                editor.clearHistory();
            });
            
            $scope.$on('logout', bindDemoLayout);
            
            var saveSite = function() {
                var site = firebase.child('layouts/' + $scope.layoutId);
                var cleanSite = $('#canvas').html();//.replace('contenteditable="true"', '');
                site.update({
                    doc: cleanSite,
                    tupAt: Firebase.ServerValue.TIMESTAMP
                });
                
                $('#saving-status').removeClass('hidden');
                $('#saving-status').fadeIn(); // queue is true by default
                $('#saving-status').fadeOut(1000);
                
            };
            
            $scope.$on('saveSite', saveSite);
            
            $(document).bind('domChanged', function(){
                saveSite();
            });
        }]);

    ibochyStudio.controller('SiteController', [
        '$rootScope', '$scope', '$firebaseArray',
        function($rootScope, $scope, $firebaseArray) {
            $scope.newSite = {};
            $scope.sites = null;

            var defaultLayout = firebase.child('layouts/_0001');
            var layouts = firebase.child('layouts');
            $scope.addSite = function() {
                if ($scope.newSite.name !== undefined) {
                    defaultLayout.once('value', function(data) {
                        var oldLayout = data.exportVal();
                        oldLayout.author_uid = $scope.authData.auth.uid; // parent scope?
                        oldLayout.tcrAt = Firebase.ServerValue.TIMESTAMP;
                        oldLayout.tupAt = Firebase.ServerValue.TIMESTAMP;
                        var newLayout = layouts.push(oldLayout);
                        $scope.sites.$add({
                            author_uid: $scope.authData.auth.uid,
                            layout_id: newLayout.key(),
                            name: $scope.newSite.name,
                            tcrAt: Firebase.ServerValue.TIMESTAMP,
                            tupAt: Firebase.ServerValue.TIMESTAMP
                        });
                        $scope.newSite = {}; // todo put in then promise
                    });
                }
                $scope.isSaveEditOff = true;
            };

            $scope.editSite = function(site) {
                site.tupAt = Firebase.ServerValue.TIMESTAMP;
                $scope.sites.$save(site).then(function() {
                    //alert('saved');
                }).catch(function(error) {
                    //alert(error);
                });
            };

            var bindSites = function() {
              var sites = firebase.child('sites')
                    .orderByChild('author_uid')
                    .equalTo($scope.authData.auth.uid);
                 $scope.sites = $firebaseArray(sites);
             };

            $scope.$on('bindSites', function(e, args) {
                bindSites();
            });

            $scope.$on('clearSites', function(e, args) {
                $scope.sites = null;
            });

            $scope.newSiteNameChanged = function(newSiteName) {
                if(newSiteName === '') {
                    $scope.isSaveEditOff = true;
                }
                else {
                    $scope.isSaveEditOff = false;
                }
            };

            $scope.openInEditor = function(site) {
                $rootScope.$broadcast('openInEditor', site);
            };
        }]);
})();

// console
// debugger
// undefined
// null
// false