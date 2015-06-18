(function(){
    var firebase = new Firebase("https://ibochy-test.firebaseio.com");

    var editor = new Editor();

    var editorTabOn = function() {
        $('#tabs a[href="#editor"]').tab('show');
    };

    var ibochyStudio = angular.module('ibochyStudio', ["firebase"]);

    ibochyStudio.controller('UserController', [
        '$rootScope', '$scope', '$firebaseAuth', '$firebaseArray', '$timeout',
        function($rootScope, $scope, $firebaseAuth, $firebaseArray, $timeout) {
            $scope.auth = $firebaseAuth(firebase);
            $scope.siteName = null; // todo dirty

            $scope.authData = $scope.auth.$getAuth();
            if ($scope.authData) {
                $scope.staff = {}; // staff is author
                $scope.staff.email = $scope.authData.password.email;
                editorTabOn();
                $timeout(function() {
                    $rootScope.$broadcast('bindSites', {}); // dirty, but works only
                });
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
                    editorTabOn();
                    // set last_seen_at
                    var author = firebase.child('authors/' + authData.uid);
                    author.update({
                        last_seen_at: Firebase.ServerValue.TIMESTAMP
                    });
                }).catch(function(error) {
                    alert("Login Failed!", error);
                    $('#login-btn').removeAttr('disabled');
                });
            };

            $scope.hideControls = function() {
                editor.paletteOff();
                $('#editorControls').hide();
                $('#palette').hide();

                // todo editor off
            };

            $scope.showControls = function() {
                $('#editorControls').show();
                editor.paletteOn();
                // todo editor on
            };

            $scope.saveSite = function() {
                $scope.$broadcast('saveSite', {});
            };

            $scope.logoutStaff = function(staff) {
                $scope.auth.$unauth();
                $scope.staff = {};
                $('#login-btn').removeAttr('disabled');
                editorTabOn();
                $rootScope.$broadcast('clearSites', {});
                $scope.showControls();
                $('#save-site-btn').attr('disabled', 'disabled');
                // todo editor off
            };
        }]);

    var initEditor = function(editor) {
        editor.createRemoveButtons('#palette');
        editor.createReplaceButtons('#palette');
        editor.createHandleButtons('#palette');

        editor.createRemoveButtons('#canvas');
        editor.createReplaceButtons('#canvas');
        editor.createHandleButtons('#canvas');

        editor.initHoverMark();
        editor.initContentEditable();

        var undoManager = editor.initUndoRedoAndDelete();
        editor.initSortable(undoManager);

        editor.initDraggable();
        editor.initFileUpload();
        editor.paletteOn();
    };

    ibochyStudio.controller('TemplateController', ['$scope',
        function($scope) {
            $scope.layoutId = null; // todo bad smell: local state
            var loadTemplate = function(layout_id) {
                $scope.layoutId = layout_id;
                firebase.child('layouts/' + layout_id).once('value', function(data) {
                    $('#canvas').html(data.val().doc); // it's layout.doc
                    initEditor(editor);
                    editorTabOn();
                    $('#editorControls').show();
                    $('#palette').show();
                });
            };
            loadTemplate('_0022');
////////////// todo danger editor loads twice
// todo reset undo
            $scope.$on('openInEditor', function(event, site) {
                loadTemplate(site.layout_id);
                $scope.$parent.siteName = site.name; // todo stale after editing name
                $('#save-site-btn').removeAttr('disabled');
            });
            
            var saveSite = function() {
                var site = firebase.child('layouts/' + $scope.layoutId);
                site.update({
                    doc: $('#canvas').html(),
                    tupAt: Firebase.ServerValue.TIMESTAMP
                });
                $('#saving-status').removeClass('hidden');
                $('#saving-status').fadeIn();
                $('#saving-status').fadeOut(1500);
            };
            
            $scope.$on('saveSite', saveSite);
            
            // todo developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            $(document).bind('domChanged', function(){
                saveSite();
                // alert('Dom changed');
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
                        oldLayout.author_uid = $scope.authData.auth.uid;
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
                        $scope.newSite = {};
                    });
                }
                $scope.isSaveEditOff = true;
            };

            $scope.editSite = function(site) {
                site.tupAt = Firebase.ServerValue.TIMESTAMP;
                $scope.sites.$save(site).then(function() {
                    //alert('saved');
                }).catch(function(error) {
                    alert(error);
                });
            };

            var bindSites = function() {
                //   var sites = firebase.child('sites');
              var sites = firebase.child('sites')
                    .orderByChild('author_uid')
                    .equalTo($scope.authData.auth.uid);
                 $scope.sites = $firebaseArray(sites);
             };

            $scope.$on('bindSites', function(event, args) {
                bindSites();
            });

            $scope.$on('clearSites', function(event, args) {
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