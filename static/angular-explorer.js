(function(window, angular) {
    'use strict';
    angular.module('FileManagerApp', ['pascalprecht.translate', 'ngFileUpload']);

    /**
     * jQuery inits
     */
    angular.element(window.document).on('shown.bs.modal', '.modal', function() {
        window.setTimeout(function() {
            angular.element('[autofocus]', this).focus();
        }.bind(this), 100);
    });

    angular.element(window.document).on('click', function() {
        angular.element('#context-menu').hide();
    });

    angular.element(window.document).on('contextmenu', '.main-navigation .table-files tr.item-list:has("td"), .item-list', function(e) {
        var menu = angular.element('#context-menu');

        if (e.pageX >= window.innerWidth - menu.width()) {
            e.pageX -= menu.width();
        }
        if (e.pageY >= window.innerHeight - menu.height()) {
            e.pageY -= menu.height();
        }

        menu.hide().css({
            left: e.pageX,
            top: e.pageY
        }).appendTo('body').show();
        e.preventDefault();
    });

    if (! Array.prototype.find) {
        Array.prototype.find = function(predicate) {
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        };
    }

})(window, angular);

(function (angular) {
    'use strict';
    var app = angular.module('FileManagerApp');

    app.directive('angularExplorer', ['$parse', 'fileManagerConfig', function ($parse, fileManagerConfig) {
        return {
            restrict: 'EA',
            templateUrl: fileManagerConfig.tplPath + '/main.html'
        };
    }]);

    app.directive('ngFile', ['$parse', function ($parse) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var model = $parse(attrs.ngFile);
                var modelSetter = model.assign;

                element.bind('change', function () {
                    scope.$apply(function () {
                        modelSetter(scope, element[0].files);
                    });
                });
            }
        };
    }]);

    app.directive('ngRightClick', ['$parse', function ($parse) {
        return function (scope, element, attrs) {
            var fn = $parse(attrs.ngRightClick);
            element.bind('contextmenu', function (event) {
                scope.$apply(function () {
                    event.preventDefault();
                    fn(scope, {
                        $event: event
                    });
                });
            });
        };
    }]);

})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('chmod', function () {

        var Chmod = function (initValue) {
            this.owner = this.getRwxObj();
            this.group = this.getRwxObj();
            this.others = this.getRwxObj();

            if (initValue) {
                var codes = isNaN(initValue) ?
                    this.convertfromCode(initValue) :
                    this.convertfromOctal(initValue);

                if (!codes) {
                    throw new Error('Invalid chmod input data (%s)'.replace('%s', initValue));
                }

                this.owner = codes.owner;
                this.group = codes.group;
                this.others = codes.others;
            }
        };

        Chmod.prototype.toOctal = function (prepend, append) {
            var result = [];
            ['owner', 'group', 'others'].forEach(function (key, i) {
                result[i] = this[key].read && this.octalValues.read || 0;
                result[i] += this[key].write && this.octalValues.write || 0;
                result[i] += this[key].exec && this.octalValues.exec || 0;
            }.bind(this));
            return (prepend || '') + result.join('') + (append || '');
        };

        Chmod.prototype.toCode = function (prepend, append) {
            var result = [];
            ['owner', 'group', 'others'].forEach(function (key, i) {
                result[i] = this[key].read && this.codeValues.read || '-';
                result[i] += this[key].write && this.codeValues.write || '-';
                result[i] += this[key].exec && this.codeValues.exec || '-';
            }.bind(this));
            return (prepend || '') + result.join('') + (append || '');
        };

        Chmod.prototype.getRwxObj = function () {
            return {
                read: false,
                write: false,
                exec: false
            };
        };

        Chmod.prototype.octalValues = {
            read: 4,
            write: 2,
            exec: 1
        };

        Chmod.prototype.codeValues = {
            read: 'r',
            write: 'w',
            exec: 'x'
        };

        Chmod.prototype.convertfromCode = function (str) {
            str = ('' + str).replace(/\s/g, '');
            str = str.length === 10 ? str.substr(1) : str;
            if (!/^[-rwxts]{9}$/.test(str)) {
                return;
            }

            var result = [],
                vals = str.match(/.{1,3}/g);
            for (var i in vals) {
                var rwxObj = this.getRwxObj();
                rwxObj.read = /r/.test(vals[i]);
                rwxObj.write = /w/.test(vals[i]);
                rwxObj.exec = /x|t/.test(vals[i]);
                result.push(rwxObj);
            }

            return {
                owner: result[0],
                group: result[1],
                others: result[2]
            };
        };

        Chmod.prototype.convertfromOctal = function (str) {
            str = ('' + str).replace(/\s/g, '');
            str = str.length === 4 ? str.substr(1) : str;
            if (!/^[0-7]{3}$/.test(str)) {
                return;
            }

            var result = [],
                vals = str.match(/.{1}/g);
            for (var i in vals) {
                var rwxObj = this.getRwxObj();
                rwxObj.read = /[4567]/.test(vals[i]);
                rwxObj.write = /[2367]/.test(vals[i]);
                rwxObj.exec = /[1357]/.test(vals[i]);
                result.push(rwxObj);
            }

            return {
                owner: result[0],
                group: result[1],
                others: result[2]
            };
        };

        return Chmod;
    });
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').factory('item', ['fileManagerConfig', 'chmod', function (fileManagerConfig, Chmod) {

        var Item = function (model, path) {
            var rawModel = {
                name: model && model.name || '',
                path: path || [],
                type: model && model.type || 'file',
                size: model && parseInt(model.size || 0),
                date: parseMySQLDate(model && model.date),
                perms: new Chmod(model && model.rights),
                content: model && model.content || '',
                recursive: false,
                fullPath: function () {
                    var path = this.path.filter(Boolean);
                    return ('/' + path.join('/') + '/' + this.name).replace(/\/\//, '/');
                }
            };

            this.error = '';
            this.processing = false;

            this.model = angular.copy(rawModel);
            this.tempModel = angular.copy(rawModel);

            function parseMySQLDate(mysqlDate) {
                var d = (mysqlDate || '').toString().split(/[- :]/);
                return new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5]);
            }
        };

        Item.prototype.update = function () {
            angular.extend(this.model, angular.copy(this.tempModel));
        };

        Item.prototype.revert = function () {
            angular.extend(this.tempModel, angular.copy(this.model));
            this.error = '';
        };

        Item.prototype.isFolder = function () {
            return this.model.type === 'dir';
        };

        Item.prototype.isEditable = function () {
            return !this.isFolder() && fileManagerConfig.isEditableFilePattern.test(this.model.name);
        };

        Item.prototype.isImage = function () {
            return fileManagerConfig.isImageFilePattern.test(this.model.name);
        };

        Item.prototype.isCompressible = function () {
            return this.isFolder();
        };

        Item.prototype.isExtractable = function () {
            return !this.isFolder() && fileManagerConfig.isExtractableFilePattern.test(this.model.name);
        };

        Item.prototype.isSelectable = function () {
            return (this.isFolder() && fileManagerConfig.allowedActions.pickFolders) || (!this.isFolder() && fileManagerConfig.allowedActions.pickFiles);
        };

        return Item;
    }]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').controller('FileManagerCtrl', [
        '$scope', '$rootScope', '$window', '$translate', 'fileManagerConfig', 'item', 'fileNavigator', 'apiMiddleware',
        function ($scope, $rootScope, $window, $translate, fileManagerConfig, Item, FileNavigator, ApiMiddleware) {

            var $storage = $window.localStorage;
            $scope.config = fileManagerConfig;
            $scope.reverse = false;
            $scope.predicate = ['model.type', 'model.name'];
            $scope.order = function (predicate) {
                $scope.reverse = ($scope.predicate[1] === predicate) ? !$scope.reverse : false;
                $scope.predicate[1] = predicate;
            };
            $scope.query = '';
            $scope.fileNavigator = new FileNavigator();
            $scope.apiMiddleware = new ApiMiddleware();
            $scope.uploadFileList = [];
            $scope.viewTemplate = $storage.getItem('viewTemplate') || 'main-icons.html';
            $scope.fileList = [];
            $scope.temps = [];

            $scope.$watch('temps', function () {
                if ($scope.singleSelection()) {
                    $scope.temp = $scope.singleSelection();
                } else {
                    $scope.temp = new Item({
                        rights: 644
                    });
                    $scope.temp.multiple = true;
                }
                $scope.temp.revert();
            });

            $scope.fileNavigator.onRefresh = function () {
                $scope.temps = [];
                $scope.query = '';
                $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
            };

            $scope.setTemplate = function (name) {
                $storage.setItem('viewTemplate', name);
                $scope.viewTemplate = name;
            };

            $scope.changeLanguage = function (locale) {
                if (locale) {
                    $storage.setItem('language', locale);
                    return $translate.use(locale);
                }
                $translate.use($storage.getItem('language') || fileManagerConfig.defaultLang);
            };

            $scope.isSelected = function (item) {
                return $scope.temps.indexOf(item) !== -1;
            };

            $scope.selectOrUnselect = function (item, $event) {
                var indexInTemp = $scope.temps.indexOf(item);
                var isRightClick = $event && $event.which == 3;

                if ($event && $event.target.hasAttribute('prevent')) {
                    $scope.temps = [];
                    return;
                }
                if (!item || (isRightClick && $scope.isSelected(item))) {
                    return;
                }
                if ($event && $event.shiftKey && !isRightClick) {
                    var list = $scope.fileList;
                    var indexInList = list.indexOf(item);
                    var lastSelected = $scope.temps[0];
                    var i = list.indexOf(lastSelected);
                    var current = undefined;
                    if (lastSelected && list.indexOf(lastSelected) < indexInList) {
                        $scope.temps = [];
                        while (i <= indexInList) {
                            current = list[i];
                            !$scope.isSelected(current) && $scope.temps.push(current);
                            i++;
                        }
                        return;
                    }
                    if (lastSelected && list.indexOf(lastSelected) > indexInList) {
                        $scope.temps = [];
                        while (i >= indexInList) {
                            current = list[i];
                            !$scope.isSelected(current) && $scope.temps.push(current);
                            i--;
                        }
                        return;
                    }
                }
                if ($event && !isRightClick && ($event.ctrlKey || $event.metaKey)) {
                    $scope.isSelected(item) ? $scope.temps.splice(indexInTemp, 1) : $scope.temps.push(item);
                    return;
                }
                $scope.temps = [item];
            };

            $scope.singleSelection = function () {
                return $scope.temps.length === 1 && $scope.temps[0];
            };

            $scope.totalSelecteds = function () {
                return {
                    total: $scope.temps.length
                };
            };

            $scope.selectionHas = function (type) {
                return $scope.temps.find(function (item) {
                    return item && item.model.type === type;
                });
            };

            $scope.prepareNewFolder = function () {
                var item = new Item(null, $scope.fileNavigator.currentPath);
                $scope.temps = [item];
                return item;
            };

            $scope.smartClick = function (item) {
                var pick = $scope.config.allowedActions.pickFiles;
                if (item.isFolder()) {
                    return $scope.fileNavigator.folderClick(item);
                }

                if (typeof $scope.config.pickCallback === 'function' && pick) {
                    var callbackSuccess = $scope.config.pickCallback(item.model);
                    if (callbackSuccess === true) {
                        return;
                    }
                }

                if (item.isImage()) {
                    if ($scope.config.previewImagesInModal) {
                        return $scope.openImagePreview(item);
                    }
                    return $scope.apiMiddleware.download(item, true);
                }

                if (item.isEditable()) {
                    return $scope.openEditItem(item);
                }
            };

            $scope.openImagePreview = function () {
                var item = $scope.singleSelection();
                $scope.apiMiddleware.apiHandler.inprocess = true;
                $scope.modal('imagepreview', null, true)
                    .find('#imagepreview-target')
                    .attr('src', $scope.getUrl(item))
                    .unbind('load error')
                    .on('load error', function () {
                        $scope.apiMiddleware.apiHandler.inprocess = false;
                        $scope.$apply();
                    });
            };

            $scope.openEditItem = function () {
                var item = $scope.singleSelection();
                $scope.apiMiddleware.getContent(item).then(function (data) {
                    item.tempModel.content = item.model.content = data.result;
                });
                $scope.modal('edit');
            };

            $scope.modal = function (id, hide, returnElement) {
                var element = angular.element('#' + id);
                element.modal(hide ? 'hide' : 'show');
                $scope.apiMiddleware.apiHandler.error = '';
                $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                return returnElement ? element : true;
            };

            $scope.modalWithPathSelector = function (id) {
                $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
                return $scope.modal(id);
            };

            $scope.isInThisPath = function (path) {
                var currentPath = $scope.fileNavigator.currentPath.join('/') + '/';
                return currentPath.indexOf(path + '/') !== -1;
            };

            $scope.edit = function () {
                $scope.apiMiddleware.edit($scope.singleSelection()).then(function () {
                    $scope.modal('edit', true);
                });
            };

            $scope.changePermissions = function () {
                $scope.apiMiddleware.changePermissions($scope.temps, $scope.temp).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('changepermissions', true);
                });
            };

            $scope.download = function () {
                var item = $scope.singleSelection();
                if ($scope.selectionHas('dir')) {
                    return;
                }
                if (item) {
                    return $scope.apiMiddleware.download(item);
                }
                return $scope.apiMiddleware.downloadMultiple($scope.temps);
            };

            $scope.copy = function () {
                var item = $scope.singleSelection();
                if (item) {
                    var name = item.tempModel.name.trim();
                    var nameExists = $scope.fileNavigator.fileNameExists(name);
                    if (nameExists && validateSamePath(item)) {
                        $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                        return false;
                    }
                    if (!name) {
                        $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                        return false;
                    }
                }
                $scope.apiMiddleware.copy($scope.temps, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('copy', true);
                });
            };

            $scope.compress = function () {
                var name = $scope.temp.tempModel.name.trim();
                var nameExists = $scope.fileNavigator.fileNameExists(name);

                if (nameExists && validateSamePath($scope.temp)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                if (!name) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }

                $scope.apiMiddleware.compress($scope.temps, name, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    if (!$scope.config.compressAsync) {
                        return $scope.modal('compress', true);
                    }
                    $scope.apiMiddleware.apiHandler.asyncSuccess = true;
                }, function () {
                    $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                });
            };

            $scope.extract = function () {
                var item = $scope.temp;
                var name = $scope.temp.tempModel.name.trim();
                var nameExists = $scope.fileNavigator.fileNameExists(name);

                if (nameExists && validateSamePath($scope.temp)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                if (!name) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }

                $scope.apiMiddleware.extract(item, name, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    if (!$scope.config.extractAsync) {
                        return $scope.modal('extract', true);
                    }
                    $scope.apiMiddleware.apiHandler.asyncSuccess = true;
                }, function () {
                    $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                });
            };

            $scope.remove = function () {
                $scope.apiMiddleware.remove($scope.temps).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('remove', true);
                });
            };

            $scope.move = function () {
                var anyItem = $scope.singleSelection() || $scope.temps[0];
                if (anyItem && validateSamePath(anyItem)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_cannot_move_same_path');
                    return false;
                }
                $scope.apiMiddleware.move($scope.temps, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('move', true);
                });
            };

            $scope.rename = function () {
                var item = $scope.singleSelection();
                var name = item.tempModel.name;
                var samePath = item.tempModel.path.join('') === item.model.path.join('');
                if (!name || (samePath && $scope.fileNavigator.fileNameExists(name))) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                $scope.apiMiddleware.rename(item).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('rename', true);
                });
            };

            $scope.createFolder = function () {
                var item = $scope.singleSelection();
                var name = item.tempModel.name;
                if (!name || $scope.fileNavigator.fileNameExists(name)) {
                    return $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                }
                $scope.apiMiddleware.createFolder(item).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('newfolder', true);
                });
            };

            $scope.addForUpload = function ($files) {
                $scope.uploadFileList = $scope.uploadFileList.concat($files);
                $scope.modal('uploadfile');
            };

            $scope.removeFromUpload = function (index) {
                $scope.uploadFileList.splice(index, 1);
            };

            $scope.uploadFiles = function () {
                $scope.apiMiddleware.upload($scope.uploadFileList, $scope.fileNavigator.currentPath).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.uploadFileList = [];
                    $scope.modal('uploadfile', true);
                }, function (data) {
                    var errorMsg = data.result && data.result.error || $translate.instant('error_uploading_files');
                    $scope.apiMiddleware.apiHandler.error = errorMsg;
                });
            };

            $scope.getUrl = function (_item) {
                return $scope.apiMiddleware.getUrl(_item);
            };

            var validateSamePath = function (item) {
                var selectedPath = $rootScope.selectedModalPath.join('');
                var selectedItemsPath = item && item.model.path.join('');
                return selectedItemsPath === selectedPath;
            };

            var getQueryParam = function (param) {
                var found = $window.location.search.substr(1).split('&').filter(function (item) {
                    return param === item.split('=')[0];
                });
                return found[0] && found[0].split('=')[1] || undefined;
            };

            $scope.changeLanguage(getQueryParam('lang'));
            $scope.isWindows = getQueryParam('server') === 'Windows';
            $scope.fileNavigator.refresh();

        }
    ]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').controller('ModalFileManagerCtrl',
        ['$scope', '$rootScope', 'fileNavigator', function ($scope, $rootScope, FileNavigator) {

            $scope.reverse = false;
            $scope.predicate = ['model.type', 'model.name'];
            $scope.fileNavigator = new FileNavigator();
            $rootScope.selectedModalPath = [];

            $scope.order = function (predicate) {
                $scope.reverse = ($scope.predicate[1] === predicate) ? !$scope.reverse : false;
                $scope.predicate[1] = predicate;
            };

            $scope.select = function (item) {
                $rootScope.selectedModalPath = item.model.fullPath().split('/').filter(Boolean);
                $scope.modal('selector', true);
            };

            $scope.selectCurrent = function () {
                $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
                $scope.modal('selector', true);
            };

            $scope.selectedFilesAreChildOfPath = function (item) {
                var path = item.model.fullPath();
                return $scope.temps.find(function (item) {
                    var itemPath = item.model.fullPath();
                    if (path == itemPath) {
                        return true;
                    }
                    /*
                    if (path.startsWith(itemPath)) {
                        fixme names in same folder like folder-one and folder-one-two
                        at the moment fixed hidding affected folders
                    }
                    */
                });
            };

            $rootScope.openNavigator = function (path) {
                $scope.fileNavigator.currentPath = path;
                $scope.fileNavigator.refresh();
                $scope.modal('selector');
            };

            $rootScope.getSelectedPath = function () {
                var path = $rootScope.selectedModalPath.filter(Boolean);
                var result = '/' + path.join('/');
                if ($scope.singleSelection() && !$scope.singleSelection().isFolder()) {
                    result += '/' + $scope.singleSelection().tempModel.name;
                }
                return result.replace(/\/\//, '/');
            };

        }]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').provider('fileManagerConfig', function () {

        var values = {
            appName: 'angular-explorer v1.5.3',
            defaultLang: 'en',
            multiLang: true,

            listUrl: 'api/handler',
            renameUrl: 'api/handler',
            copyUrl: 'api/handler',
            moveUrl: 'api/handler',
            removeUrl: 'api/handler',
            editUrl: 'api/handler',
            getContentUrl: 'api/handler',
            createFolderUrl: 'api/handler',
            uploadUrl: 'api/upload',
            downloadFileUrl: 'api/download',
            downloadMultipleUrl: 'api/download',
            compressUrl: 'api/handler',
            extractUrl: 'api/handler',
            permissionsUrl: 'api/handler',
            basePath: '/',

            searchForm: true,
            sidebar: true,
            breadcrumb: true,
            allowedActions: {
                upload: true,
                rename: true,
                move: true,
                copy: true,
                edit: true,
                changePermissions: true,
                compress: true,
                compressChooseName: true,
                extract: true,
                download: true,
                downloadMultiple: true,
                preview: true,
                remove: true,
                createFolder: true,
                pickFiles: false,
                pickFolders: false
            },

            multipleDownloadFileName: 'angular-explorer.zip',
            filterFileExtensions: [],
            showExtensionIcons: true,
            showSizeForDirectories: false,
            useBinarySizePrefixes: false,
            downloadFilesByAjax: true,
            previewImagesInModal: true,
            enablePermissionsRecursive: true,
            compressAsync: false,
            extractAsync: false,
            pickCallback: null,

            isEditableFilePattern: /\.(txt|diff?|patch|svg|asc|cnf|cfg|conf|html?|.html|cfm|cgi|aspx?|ini|pl|py|md|css|cs|js|jsp|log|htaccess|htpasswd|gitignore|gitattributes|env|json|atom|eml|rss|markdown|sql|xml|xslt?|sh|rb|as|bat|cmd|cob|for|ftn|frm|frx|inc|lisp|scm|coffee|php[3-6]?|java|c|cbl|go|h|scala|vb|tmpl|lock|go|yml|yaml|tsv|lst)$/i,
            isImageFilePattern: /\.(jpe?g|gif|bmp|png|svg|tiff?)$/i,
            isExtractableFilePattern: /\.(gz|tar|rar|g?zip)$/i,
            tplPath: 'src/templates'
        };

        return {
            $get: function () {
                return values;
            },
            set: function (constants) {
                angular.extend(values, constants);
            }
        };

    });
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').config(['$translateProvider', function ($translateProvider) {
        $translateProvider.useSanitizeValueStrategy(null);

        $translateProvider.translations('en', {
            filemanager: 'File Manager',
            language: 'Language',
            english: 'English',
            spanish: 'Spanish',
            portuguese: 'Portuguese',
            french: 'French',
            german: 'German',
            hebrew: 'Hebrew',
            italian: 'Italian',
            slovak: 'Slovak',
            chinese_tw: 'Traditional Chinese',
            chinese_cn: 'Simple Chinese',
            russian: 'Russian',
            ukrainian: 'Ukrainian',
            turkish: 'Turkish',
            persian: 'Persian',
            polish: 'Polish',
            dutch: 'Dutch',
            confirm: 'Confirm',
            cancel: 'Cancel',
            close: 'Close',
            upload_files: 'Upload files',
            files_will_uploaded_to: 'Files will be uploaded to',
            select_files: 'Select files',
            uploading: 'Uploading',
            permissions: 'Permissions',
            select_destination_folder: 'Select the destination folder',
            source: 'Source',
            destination: 'Destination',
            copy_file: 'Copy file',
            sure_to_delete: 'Are you sure to delete',
            change_name_move: 'Change name / move',
            enter_new_name_for: 'Enter new name for',
            extract_item: 'Extract item',
            extraction_started: 'Extraction started in a background process',
            compression_started: 'Compression started in a background process',
            enter_folder_name_for_extraction: 'Enter the folder name for the extraction of',
            enter_file_name_for_compression: 'Enter the file name for the compression of',
            toggle_fullscreen: 'Toggle fullscreen',
            edit_file: 'Edit file',
            file_content: 'File content',
            loading: 'Loading',
            search: 'Search',
            create_folder: 'Create folder',
            create: 'Create',
            folder_name: 'Folder name',
            upload: 'Upload',
            change_permissions: 'Change permissions',
            change: 'Change',
            details: 'Details',
            icons: 'Icons',
            list: 'List',
            name: 'Name',
            size: 'Size',
            actions: 'Actions',
            date: 'Date',
            selection: 'Selection',
            no_files_in_folder: 'No files in this folder',
            no_folders_in_folder: 'This folder not contains children folders',
            select_this: 'Select this',
            go_back: 'Go back',
            wait: 'Wait',
            move: 'Move',
            download: 'Download',
            view_item: 'View item',
            remove: 'Delete',
            edit: 'Edit',
            save: 'Save',
            copy: 'Copy',
            rename: 'Rename',
            extract: 'Extract',
            compress: 'Compress',
            error_invalid_filename: 'Invalid filename or already exists, specify another name',
            error_modifying: 'An error occurred modifying the file',
            error_deleting: 'An error occurred deleting the file or folder',
            error_renaming: 'An error occurred renaming the file',
            error_copying: 'An error occurred copying the file',
            error_compressing: 'An error occurred compressing the file or folder',
            error_extracting: 'An error occurred extracting the file',
            error_creating_folder: 'An error occurred creating the folder',
            error_getting_content: 'An error occurred getting the content of the file',
            error_changing_perms: 'An error occurred changing the permissions of the file',
            error_uploading_files: 'An error occurred uploading files',
            sure_to_start_compression_with: 'Are you sure to compress',
            owner: 'Owner',
            group: 'Group',
            others: 'Others',
            read: 'Read',
            write: 'Write',
            exec: 'Exec',
            original: 'Original',
            changes: 'Changes',
            recursive: 'Recursive',
            preview: 'Item preview',
            open: 'Open',
            these_elements: 'these {{total}} elements',
            new_folder: 'New folder',
            download_as_zip: 'Download as ZIP'
        });

        $translateProvider.translations('nl', {
            filemanager: 'Bestand beheerder',
            language: 'Taal',
            english: 'Engels',
            spanish: 'Spaans',
            portuguese: 'Portugees',
            french: 'Frans',
            german: 'Duits',
            hebrew: 'Hebrews',
            slovak: 'Slowakije',
            chinese: 'Chinees',
            russian: 'Russisch',
            ukrainian: 'Oekraïens',
            turkish: 'Turks',
            persian: 'Perzisch',
            confirm: 'Bevestigen',
            cancel: 'Annuleren',
            close: 'Sluiten',
            upload_files: 'Bestanden uploaden',
            files_will_uploaded_to: 'Bestanden worden geüpload naar',
            select_files: 'Selecteer bestanden',
            uploading: 'Uploaden',
            permissions: 'Rechten',
            select_destination_folder: 'Selecteer de map van bestemming',
            source: 'Bron',
            destination: 'Doel',
            copy_file: 'Kopieer bestand',
            sure_to_delete: 'Weet je zeker dat je wilt verwijderen',
            change_name_move: 'Hernoemen / verplaatsen',
            enter_new_name_for: 'Typ een nieuwe naam voor',
            extract_item: 'Uitpakken',
            extraction_started: 'Uitpakken gestart als achtergrond proces',
            compression_started: 'Inpakken gestart als achtergrond proces',
            enter_folder_name_for_extraction: 'Typ een map naar voor het uitpakken van',
            enter_file_name_for_compression: 'Typ een bestandsnaam voor het inpakken van',
            toggle_fullscreen: 'Volledigscherm',
            edit_file: 'Bewerk bestand',
            file_content: 'Bestandsinhoud',
            loading: 'Laden',
            search: 'Zoeken',
            create_folder: 'Maak map',
            create: 'Maak',
            folder_name: 'Map naam',
            upload: 'Uploaden',
            change_permissions: 'Rechten aanpassen',
            change: 'Aanpassen',
            details: 'Details',
            icons: 'Iconen',
            list: 'Lijst',
            name: 'Naam',
            size: 'Grootte',
            actions: 'Acties',
            date: 'Datum',
            no_files_in_folder: 'Geen bestanden in deze map',
            no_folders_in_folder: 'Deze map bevat geen submappen',
            select_this: 'Selecteer dit',
            go_back: 'Ga terug',
            wait: 'Wacht',
            move: 'Verplaats',
            download: 'Download',
            view_item: 'Bekijk item',
            remove: 'Verwijderen',
            edit: 'Bewerken',
            save: 'Bewerken',
            copy: 'Kopiëren',
            rename: 'Hernoemen',
            extract: 'Uitpakken',
            compress: 'Inpakken',
            error_invalid_filename: 'Ongeldige bestandsnaam of bestand al aanwezig, kies een andere naam',
            error_modifying: 'Er is een fout opgetreden met het bewerken van het bestand',
            error_deleting: 'Er is een fout opgetreden tijdens het verwijderen van de bestand of map',
            error_renaming: 'Er is een fout opgetreden tijdens het hernoemen van het bestand',
            error_copying: 'Er is een fout opgetreden tijdens het kopiëren van het bestand',
            error_compressing: 'Er is een fout opgetreden tijdens het inpakken van het bestand of map',
            error_extracting: 'Er is een fout opgetreden tijdens het uitpakken van het bestand',
            error_creating_folder: 'Er is een fout opgetreden tijdens het maken van de map',
            error_getting_content: 'Er is een fout opgetreden tijdens het ophalen van de inhoud van het bestand',
            error_changing_perms: 'Er is een fout opgetreden tijdens het aanpassen van de rechten van het bestand',
            error_uploading_files: 'Er is een fout opgetreden tijdens het uploaden van de bestanden',
            sure_to_start_compression_with: 'Weet je zeker dat je dit wilt inpakken',
            owner: 'Eigenaar',
            group: 'Groep',
            others: 'Andere',
            read: 'Lees',
            write: 'Schrijf',
            exec: 'Uitvoeren',
            original: 'Origineel',
            changes: 'Aanpassingen',
            recursive: 'Recursieve',
            preview: 'Item bekijken',
            open: 'Openen',
            these_elements: 'Deze {{total}} elementen',
            new_folder: 'Nieuwe map',
            download_as_zip: 'Download als ZIP'
        });

        $translateProvider.translations('he', {
            filemanager: 'מנהל קבצים',
            language: 'שפה',
            english: 'אנגלית',
            spanish: 'ספרדית',
            portuguese: 'פורטוגזית',
            french: 'צרפתית',
            german: 'גרמנית',
            hebrew: 'עברי',
            italian: 'איטלקי',
            slovak: 'סלובקי',
            chinese_tw: 'סינית מסורתית',
            chinese_cn: 'סינית פשוטה',
            russian: 'רוּסִי',
            ukrainian: 'אוקראיני',
            turkish: 'טורקי',
            persian: 'פַּרסִית',
            polish: 'פולני',
            confirm: 'אשר',
            cancel: 'בטל',
            close: 'סגור',
            upload_files: 'העלה קבצים',
            files_will_uploaded_to: 'הקבצים יעלו ל',
            select_files: 'בחר קבצים',
            uploading: 'מעלה',
            permissions: 'הרשאות',
            select_destination_folder: 'בחר תיקיית יעד',
            source: 'מקור',
            destination: 'יעד',
            copy_file: 'העתק קובץ',
            sure_to_delete: 'האם אתה בטוח שברצונך למחוק',
            change_name_move: 'שנה שם / הזז',
            enter_new_name_for: 'הקלד שם חדש עבור',
            extract_item: 'חלץ פריט',
            extraction_started: 'תהליך החילוץ מתבצע ברקע',
            compression_started: 'תהליך הכיווץ מתבצע ברקע',
            enter_folder_name_for_extraction: 'הקלד שם תיקייה לחילוץ עבור',
            enter_file_name_for_compression: 'הזן את שם הקובץ עבור הדחיסה של',
            toggle_fullscreen: 'הפעל/בטל מסך מלא',
            edit_file: 'ערוך קובץ',
            file_content: 'תוכן הקובץ',
            loading: 'טוען',
            search: 'חפש',
            create_folder: 'צור תיקייה',
            create: 'צור',
            folder_name: 'שם תיקייה',
            upload: 'העלה',
            change_permissions: 'שנה הרשאות',
            change: 'שנה',
            details: 'פרטים',
            icons: 'סמלים',
            list: 'רשימה',
            name: 'שם',
            size: 'גודל',
            actions: 'פעולות',
            date: 'תאריך',
            selection: 'בְּחִירָה',
            no_files_in_folder: 'אין קבצים בתיקייה זו',
            no_folders_in_folder: 'התיקייה הזו אינה כוללת תתי תיקיות',
            select_this: 'בחר את זה',
            go_back: 'חזור אחורה',
            wait: 'חכה',
            move: 'הזז',
            download: 'הורד',
            view_item: 'הצג פריט',
            remove: 'מחק',
            edit: 'ערוך',
            save: 'ערוך',
            copy: 'העתק',
            rename: 'שנה שם',
            extract: 'חלץ',
            compress: 'כווץ',
            error_invalid_filename: 'שם קובץ אינו תקין או קיים, ציין שם קובץ אחר',
            error_modifying: 'התרחשה שגיאה בעת שינוי הקובץ',
            error_deleting: 'התרחשה שגיאה בעת מחיקת הקובץ או התיקייה',
            error_renaming: 'התרחשה שגיאה בעת שינוי שם הקובץ',
            error_copying: 'התרחשה שגיאה בעת העתקת הקובץ',
            error_compressing: 'התרחשה שגיאה בעת כיווץ הקובץ או התיקייה',
            error_extracting: 'התרחשה שגיאה בעת חילוץ הקובץ או התיקייה',
            error_creating_folder: 'התרחשה שגיאה בעת יצירת התיקייה',
            error_getting_content: 'התרחשה שגיאה בעת בקשת תוכן הקובץ',
            error_changing_perms: 'התרחשה שגיאה בעת שינוי הרשאות הקובץ',
            error_uploading_files: 'התרחשה שגיאה בעת העלאת הקבצים',
            sure_to_start_compression_with: 'האם אתה בטוח שברצונך לכווץ',
            owner: 'בעלים',
            group: 'קבוצה',
            others: 'אחרים',
            read: 'קריאה',
            write: 'כתיבה',
            exec: 'הרצה',
            original: 'מקורי',
            changes: 'שינויים',
            recursive: 'רקורסיה',
            preview: 'הצגת פריט',
            open: 'פתח',
            new_folder: 'תיקיה חדשה',
            download_as_zip: 'להוריד כמו'
        });

        $translateProvider.translations('pt', {
            filemanager: 'Gerenciador de arquivos',
            language: 'Língua',
            english: 'Inglês',
            spanish: 'Espanhol',
            portuguese: 'Portugues',
            french: 'Francês',
            german: 'Alemão',
            hebrew: 'Hebraico',
            italian: 'Italiano',
            slovak: 'Eslovaco',
            chinese_tw: 'Tradicional Chinesa',
            chinese_cn: 'Chinês Simplificado',
            russian: 'Russo',
            ukrainian: 'Ucraniano',
            turkish: 'Turco',
            persian: 'Persa',
            polish: 'Polonês',
            confirm: 'Confirmar',
            cancel: 'Cancelar',
            close: 'Fechar',
            upload_files: 'Carregar arquivos',
            files_will_uploaded_to: 'Os arquivos serão enviados para',
            select_files: 'Selecione os arquivos',
            uploading: 'Carregar',
            permissions: 'Autorizações',
            select_destination_folder: 'Selecione a pasta de destino',
            source: 'Origem',
            destination: 'Destino',
            copy_file: 'Copiar arquivo',
            sure_to_delete: 'Tem certeza de que deseja apagar',
            change_name_move: 'Renomear / mudança',
            enter_new_name_for: 'Digite o novo nome para',
            extract_item: 'Extrair arquivo',
            extraction_started: 'A extração começou em um processo em segundo plano',
            compression_started: 'A compressão começou em um processo em segundo plano',
            enter_folder_name_for_extraction: 'Digite o nome da pasta para a extração de',
            enter_file_name_for_compression: 'Digite o nome do arquivo para a compressão de',
            toggle_fullscreen: 'Ativar/desativar tela cheia',
            edit_file: 'Editar arquivo',
            file_content: 'Conteúdo do arquivo',
            loading: 'Carregando',
            search: 'Localizar',
            create_folder: 'Criar Pasta',
            create: 'Criar',
            folder_name: 'Nome da pasta',
            upload: 'Fazer',
            change_permissions: 'Alterar permissões',
            change: 'Alterar',
            details: 'Detalhes',
            icons: 'Icones',
            list: 'Lista',
            name: 'Nome',
            size: 'Tamanho',
            actions: 'Ações',
            date: 'Data',
            selection: 'Seleção',
            no_files_in_folder: 'Não há arquivos nesta pasta',
            no_folders_in_folder: 'Esta pasta não contém subpastas',
            select_this: 'Selecione esta',
            go_back: 'Voltar',
            wait: 'Espere',
            move: 'Mover',
            download: 'Baixar',
            view_item: 'Veja o arquivo',
            remove: 'Excluir',
            edit: 'Editar',
            save: 'Editar',
            copy: 'Copiar',
            rename: 'Renomear',
            extract: 'Extrair',
            compress: 'Comprimir',
            error_invalid_filename: 'Nome do arquivo inválido ou nome de arquivo já existe, especifique outro nome',
            error_modifying: 'Ocorreu um erro ao modificar o arquivo',
            error_deleting: 'Ocorreu um erro ao excluir o arquivo ou pasta',
            error_renaming: 'Ocorreu um erro ao mudar o nome do arquivo',
            error_copying: 'Ocorreu um erro ao copiar o arquivo',
            error_compressing: 'Ocorreu um erro ao comprimir o arquivo ou pasta',
            error_extracting: 'Ocorreu um erro ao extrair o arquivo',
            error_creating_folder: 'Ocorreu um erro ao criar a pasta',
            error_getting_content: 'Ocorreu um erro ao obter o conteúdo do arquivo',
            error_changing_perms: 'Ocorreu um erro ao alterar as permissões do arquivo',
            error_uploading_files: 'Ocorreu um erro upload de arquivos',
            sure_to_start_compression_with: 'Tem certeza que deseja comprimir',
            owner: 'Proprietário',
            group: 'Grupo',
            others: 'Outros',
            read: 'Leitura',
            write: 'Escrita ',
            exec: 'Execução',
            original: 'Original',
            changes: 'Mudanças',
            recursive: 'Recursiva',
            preview: 'Visualização',
            open: 'Abrir',
            these_elements: 'estes {{total}} elements',
            new_folder: 'Nova pasta',
            download_as_zip: 'Download como ZIP'
        });

        $translateProvider.translations('es', {
            filemanager: 'Administrador de archivos',
            language: 'Idioma',
            english: 'Ingles',
            spanish: 'Español',
            portuguese: 'Portugues',
            french: 'Francés',
            german: 'Alemán',
            hebrew: 'Hebreo',
            italian: 'Italiano',
            slovak: 'Eslovaco',
            chinese_tw: 'Tradicional China',
            chinese_cn: 'Chino Simplificado',
            russian: 'Ruso',
            ukrainian: 'Ucraniano',
            turkish: 'Turco',
            persian: 'Persa',
            polish: 'Polaco',
            confirm: 'Confirmar',
            cancel: 'Cancelar',
            close: 'Cerrar',
            upload_files: 'Subir archivos',
            files_will_uploaded_to: 'Los archivos seran subidos a',
            select_files: 'Seleccione los archivos',
            uploading: 'Subiendo',
            permissions: 'Permisos',
            select_destination_folder: 'Seleccione la carpeta de destino',
            source: 'Origen',
            destination: 'Destino',
            copy_file: 'Copiar archivo',
            sure_to_delete: 'Esta seguro que desea eliminar',
            change_name_move: 'Renombrar / mover',
            enter_new_name_for: 'Ingrese el nuevo nombre para',
            extract_item: 'Extraer archivo',
            extraction_started: 'La extraccion ha comenzado en un proceso de segundo plano',
            compression_started: 'La compresion ha comenzado en un proceso de segundo plano',
            enter_folder_name_for_extraction: 'Ingrese el nombre de la carpeta para la extraccion de',
            enter_file_name_for_compression: 'Ingrese el nombre del archivo para la compresion de',
            toggle_fullscreen: 'Activar/Desactivar pantalla completa',
            edit_file: 'Editar archivo',
            file_content: 'Contenido del archivo',
            loading: 'Cargando',
            search: 'Buscar',
            create_folder: 'Crear carpeta',
            create: 'Crear',
            folder_name: 'Nombre de la carpeta',
            upload: 'Subir',
            change_permissions: 'Cambiar permisos',
            change: 'Cambiar',
            details: 'Detalles',
            icons: 'Iconos',
            list: 'Lista',
            name: 'Nombre',
            size: 'Tamaño',
            actions: 'Acciones',
            date: 'Fecha',
            selection: 'Selección',
            no_files_in_folder: 'No hay archivos en esta carpeta',
            no_folders_in_folder: 'Esta carpeta no contiene sub-carpetas',
            select_this: 'Seleccionar esta',
            go_back: 'Volver',
            wait: 'Espere',
            move: 'Mover',
            download: 'Descargar',
            view_item: 'Ver archivo',
            remove: 'Eliminar',
            edit: 'Editar',
            save: 'Editar',
            copy: 'Copiar',
            rename: 'Renombrar',
            extract: 'Extraer',
            compress: 'Comprimir',
            error_invalid_filename: 'El nombre del archivo es invalido o ya existe',
            error_modifying: 'Ocurrio un error al intentar modificar el archivo',
            error_deleting: 'Ocurrio un error al intentar eliminar el archivo',
            error_renaming: 'Ocurrio un error al intentar renombrar el archivo',
            error_copying: 'Ocurrio un error al intentar copiar el archivo',
            error_compressing: 'Ocurrio un error al intentar comprimir el archivo',
            error_extracting: 'Ocurrio un error al intentar extraer el archivo',
            error_creating_folder: 'Ocurrio un error al intentar crear la carpeta',
            error_getting_content: 'Ocurrio un error al obtener el contenido del archivo',
            error_changing_perms: 'Ocurrio un error al cambiar los permisos del archivo',
            error_uploading_files: 'Ocurrio un error al subir archivos',
            sure_to_start_compression_with: 'Esta seguro que desea comprimir',
            owner: 'Propietario',
            group: 'Grupo',
            others: 'Otros',
            read: 'Lectura',
            write: 'Escritura',
            exec: 'Ejecucion',
            original: 'Original',
            changes: 'Cambios',
            recursive: 'Recursivo',
            preview: 'Vista previa',
            open: 'Abrir',
            these_elements: 'estos {{total}} elementos',
            new_folder: 'Nueva carpeta',
            download_as_zip: 'Descargar como ZIP'
        });

        $translateProvider.translations('fr', {
            filemanager: 'Gestionnaire de fichier',
            language: 'Langue',
            english: 'Anglais',
            spanish: 'Espagnol',
            portuguese: 'Portugais',
            french: 'Français',
            german: 'Allemand',
            hebrew: 'Hébreu',
            italian: 'Italien',
            slovak: 'Slovaque',
            chinese_tw: 'Traditionnelle Chinoise',
            chinese_cn: 'Chinois Simplifié',
            russian: 'Russe',
            ukrainian: 'Ukrainien',
            turkish: 'Turc',
            persian: 'Persan',
            polish: 'Polonais',
            confirm: 'Confirmer',
            cancel: 'Annuler',
            close: 'Fermer',
            upload_files: 'Télécharger des fichiers',
            files_will_uploaded_to: 'Les fichiers seront uploadé dans',
            select_files: 'Sélectionnez les fichiers',
            uploading: 'Upload en cours',
            permissions: 'Permissions',
            select_destination_folder: 'Sélectionné le dossier de destination',
            source: 'Source',
            destination: 'Destination',
            copy_file: 'Copier le fichier',
            sure_to_delete: 'Êtes-vous sûr de vouloir supprimer',
            change_name_move: 'Renommer / Déplacer',
            enter_new_name_for: 'Entrer le nouveau nom pour',
            extract_item: 'Extraires les éléments',
            extraction_started: 'L\'extraction a démarré en tâche de fond',
            compression_started: 'La compression a démarré en tâche de fond',
            enter_folder_name_for_extraction: 'Entrer le nom du dossier pour l\'extraction de',
            enter_file_name_for_compression: 'Entrez le nom de fichier pour la compression de',
            toggle_fullscreen: 'Basculer en plein écran',
            edit_file: 'Éditer le fichier',
            file_content: 'Contenu du fichier',
            loading: 'Chargement en cours',
            search: 'Recherche',
            create_folder: 'Créer un dossier',
            create: 'Créer',
            folder_name: 'Nom du dossier',
            upload: 'Upload',
            change_permissions: 'Changer les permissions',
            change: 'Changer',
            details: 'Details',
            icons: 'Icons',
            list: 'Liste',
            name: 'Nom',
            size: 'Taille',
            actions: 'Actions',
            date: 'Date',
            selection: 'Sélection',
            no_files_in_folder: 'Aucun fichier dans ce dossier',
            no_folders_in_folder: 'Ce dossier ne contiens pas de dossier',
            select_this: 'Sélectionner',
            go_back: 'Retour',
            wait: 'Patienter',
            move: 'Déplacer',
            download: 'Télécharger',
            view_item: 'Voir l\'élément',
            remove: 'Supprimer',
            edit: 'Éditer',
            save: 'Éditer',
            copy: 'Copier',
            rename: 'Renommer',
            extract: 'Extraire',
            compress: 'Compresser',
            error_invalid_filename: 'Nom de fichier invalide ou déjà existant, merci de spécifier un autre nom',
            error_modifying: 'Une erreur est survenue pendant la modification du fichier',
            error_deleting: 'Une erreur est survenue pendant la suppression du fichier ou du dossier',
            error_renaming: 'Une erreur est survenue pendant le renommage du fichier',
            error_copying: 'Une erreur est survenue pendant la copie du fichier',
            error_compressing: 'Une erreur est survenue pendant la compression du fichier ou du dossier',
            error_extracting: 'Une erreur est survenue pendant l\'extraction du fichier',
            error_creating_folder: 'Une erreur est survenue pendant la création du dossier',
            error_getting_content: 'Une erreur est survenue pendant la récupération du contenu du fichier',
            error_changing_perms: 'Une erreur est survenue pendant le changement des permissions du fichier',
            error_uploading_files: 'Une erreur est survenue pendant l\'upload des fichiers',
            sure_to_start_compression_with: 'Êtes-vous sûre de vouloir compresser',
            owner: 'Propriétaire',
            group: 'Groupe',
            others: 'Autres',
            read: 'Lecture',
            write: 'Écriture',
            exec: 'Éxécution',
            original: 'Original',
            changes: 'Modifications',
            recursive: 'Récursif',
            preview: 'Aperçu',
            open: 'Ouvrir',
            these_elements: 'ces {{total}} éléments',
            new_folder: 'Nouveau dossier',
            download_as_zip: 'Télécharger comme ZIP'
        });

        $translateProvider.translations('de', {
            filemanager: 'Dateimanager',
            language: 'Sprache',
            english: 'Englisch',
            spanish: 'Spanisch',
            portuguese: 'Portugiesisch',
            french: 'Französisch',
            german: 'Deutsch',
            hebrew: 'Hebräisch',
            italian: 'Italienisch',
            slovak: 'Slowakisch',
            chinese_tw: 'Traditionelles Chinesisch',
            chinese_cn: 'Vereinfachtes Chinesisch',
            russian: 'Russisch',
            ukrainian: 'Ukrainisch',
            turkish: 'Türkisch',
            persian: 'Persisch',
            polish: 'Polnisch',
            confirm: 'Bestätigen',
            cancel: 'Abbrechen',
            close: 'Schließen',
            upload_files: 'Hochladen von Dateien',
            files_will_uploaded_to: 'Dateien werden hochgeladen nach',
            select_files: 'Wählen Sie die Dateien',
            uploading: 'Lade hoch',
            permissions: 'Berechtigungen',
            select_destination_folder: 'Wählen Sie einen Zielordner',
            source: 'Quelle',
            destination: 'Ziel',
            copy_file: 'Datei kopieren',
            sure_to_delete: 'Sind Sie sicher, dass Sie die Datei löschen möchten?',
            change_name_move: 'Namen ändern / verschieben',
            enter_new_name_for: 'Geben Sie den neuen Namen ein für',
            extract_item: 'Archiv entpacken',
            extraction_started: 'Entpacken hat im Hintergrund begonnen',
            compression_started: 'Komprimierung hat im Hintergrund begonnen',
            enter_folder_name_for_extraction: 'Geben Sie den Verzeichnisnamen für die Entpackung an von',
            enter_file_name_for_compression: 'Geben Sie den Dateinamen für die Kompression an von',
            toggle_fullscreen: 'Vollbild umschalten',
            edit_file: 'Datei bearbeiten',
            file_content: 'Dateiinhalt',
            loading: 'Lade',
            search: 'Suche',
            create_folder: 'Ordner erstellen',
            create: 'Erstellen',
            folder_name: 'Verzeichnisname',
            upload: 'Hochladen',
            change_permissions: 'Berechtigungen ändern',
            change: 'Ändern',
            details: 'Details',
            icons: 'Symbolansicht',
            list: 'Listenansicht',
            name: 'Name',
            size: 'Größe',
            actions: 'Aktionen',
            date: 'Datum',
            selection: 'Auswahl',
            no_files_in_folder: 'Keine Dateien in diesem Ordner',
            no_folders_in_folder: 'Dieser Ordner enthält keine Unterordner',
            select_this: 'Auswählen',
            go_back: 'Zurück',
            wait: 'Warte',
            move: 'Verschieben',
            download: 'Herunterladen',
            view_item: 'Datei ansehen',
            remove: 'Löschen',
            edit: 'Bearbeiten',
            save: 'Bearbeiten',
            copy: 'Kopieren',
            rename: 'Umbenennen',
            extract: 'Entpacken',
            compress: 'Komprimieren',
            error_invalid_filename: 'Ungültiger Dateiname oder existiert bereits',
            error_modifying: 'Beim Bearbeiten der Datei ist ein Fehler aufgetreten',
            error_deleting: 'Beim Löschen der Datei oder des Ordners ist ein Fehler aufgetreten',
            error_renaming: 'Beim Umbennenen der Datei ist ein Fehler aufgetreten',
            error_copying: 'Beim Kopieren der Datei ist ein Fehler aufgetreten',
            error_compressing: 'Beim Komprimieren der Datei oder des Ordners ist ein Fehler aufgetreten',
            error_extracting: 'Beim Entpacken der Datei ist ein Fehler aufgetreten',
            error_creating_folder: 'Beim Erstellen des Ordners ist ein Fehler aufgetreten',
            error_getting_content: 'Beim Laden des Dateiinhalts ist ein Fehler aufgetreten',
            error_changing_perms: 'Beim Ändern der Dateiberechtigungen ist ein Fehler aufgetreten',
            error_uploading_files: 'Beim Hochladen der Dateien ist ein Fehler aufgetreten',
            sure_to_start_compression_with: 'Möchten Sie die Datei wirklich komprimieren?',
            owner: 'Besitzer',
            group: 'Gruppe',
            others: 'Andere',
            read: 'Lesen',
            write: 'Schreiben',
            exec: 'Ausführen',
            original: 'Original',
            changes: 'Änderungen',
            recursive: 'Rekursiv',
            preview: 'Dateivorschau',
            open: 'Öffnen',
            these_elements: 'diese {{total}} elemente',
            new_folder: 'Neuer ordner',
            download_as_zip: 'Download als ZIP'
        });

        $translateProvider.translations('sk', {
            filemanager: 'Správca súborov',
            language: 'Jazyk',
            english: 'Angličtina',
            spanish: 'Španielčina',
            portuguese: 'Portugalčina',
            french: 'Francúzština',
            german: 'Nemčina',
            hebrew: 'Hebrejčina',
            italian: 'Italština',
            slovak: 'Slovenčina',
            chinese_tw: 'Tradičná Čínska',
            chinese_cn: 'Zjednodušená Čínština',
            russian: 'Ruský',
            ukrainian: 'Ukrajinský',
            turkish: 'Turecký',
            persian: 'Perzský',
            polish: 'Poľský',
            confirm: 'Potvrdiť',
            cancel: 'Zrušiť',
            close: 'Zavrieť',
            upload_files: 'Nahrávať súbory',
            files_will_uploaded_to: 'Súbory budú nahrané do',
            select_files: 'Vybrať súbory',
            uploading: 'Nahrávanie',
            permissions: 'Oprávnenia',
            select_destination_folder: 'Vyberte cieľový príečinok',
            source: 'Zdroj',
            destination: 'Cieľ',
            copy_file: 'Kopírovať súbor',
            sure_to_delete: 'Ste si istý, že chcete vymazať',
            change_name_move: 'Premenovať / Premiestniť',
            enter_new_name_for: 'Zadajte nové meno pre',
            extract_item: 'Rozbaliť položku',
            extraction_started: 'Rozbaľovanie začalo v procese na pozadí',
            compression_started: 'Kompresia začala v procese na pzoadí',
            enter_folder_name_for_extraction: 'Zadajte názov priečinka na rozbalenie',
            enter_file_name_for_compression: 'Zadajte názov súboru pre kompresiu',
            toggle_fullscreen: 'Prepnúť režim na celú obrazovku',
            edit_file: 'Upraviť súbor',
            file_content: 'Obsah súboru',
            loading: 'Načítavanie',
            search: 'Hľadať',
            create_folder: 'Vytvoriť priečinok',
            create: 'Vytvoriť',
            folder_name: 'Názov priećinka',
            upload: 'Nahrať',
            change_permissions: 'Zmeniť oprávnenia',
            change: 'Zmeniť',
            details: 'Podrobnosti',
            icons: 'Ikony',
            list: 'Zoznam',
            name: 'Meno',
            size: 'Veľkosť',
            actions: 'Akcie',
            date: 'Dátum',
            selection: 'Výber',
            no_files_in_folder: 'V tom to priečinku nie sú žiadne súbory',
            no_folders_in_folder: 'Tento priečinok neobsahuje žiadne ďalšie priećinky',
            select_this: 'Vybrať tento',
            go_back: 'Ísť späť',
            wait: 'Počkajte',
            move: 'Presunúť',
            download: 'Stiahnuť',
            view_item: 'Zobraziť položku',
            remove: 'Vymazať',
            edit: 'Upraviť',
            save: 'Upraviť',
            copy: 'Kopírovať',
            rename: 'Premenovať',
            extract: 'Rozbaliť',
            compress: 'Komprimovať',
            error_invalid_filename: 'Neplatné alebo duplicitné meno súboru, vyberte iné meno',
            error_modifying: 'Vyskytla sa chyba pri upravovaní súboru',
            error_deleting: 'Vyskytla sa chyba pri mazaní súboru alebo priečinku',
            error_renaming: 'Vyskytla sa chyba pri premenovaní súboru',
            error_copying: 'Vyskytla sa chyba pri kopírovaní súboru',
            error_compressing: 'Vyskytla sa chyba pri komprimovaní súboru alebo priečinka',
            error_extracting: 'Vyskytla sa chyba pri rozbaľovaní súboru',
            error_creating_folder: 'Vyskytla sa chyba pri vytváraní priečinku',
            error_getting_content: 'Vyskytla sa chyba pri získavaní obsahu súboru',
            error_changing_perms: 'Vyskytla sa chyba pri zmene oprávnení súboru',
            error_uploading_files: 'Vyskytla sa chyba pri nahrávaní súborov',
            sure_to_start_compression_with: 'Ste si istý, že chcete komprimovať',
            owner: 'Vlastník',
            group: 'Skupina',
            others: 'Ostatní',
            read: 'Čítanie',
            write: 'Zapisovanie',
            exec: 'Spúštanie',
            original: 'Originál',
            changes: 'Zmeny',
            recursive: 'Rekurzívne',
            preview: 'Náhľad položky',
            open: 'Otvoriť',
            these_elements: 'týchto {{total}} prvkov',
            new_folder: 'Nový priečinok',
            download_as_zip: 'Stiahnuť ako ZIP'
        });

        $translateProvider.translations('zh_cn', {
            filemanager: '文档管理器',
            language: '语言',
            english: '英语',
            spanish: '西班牙语',
            portuguese: '葡萄牙语',
            french: '法语',
            german: '德语',
            hebrew: '希伯来语',
            italian: '意大利',
            slovak: '斯洛伐克语',
            chinese_tw: '正体中文',
            chinese_cn: '简体中文',
            russian: '俄語',
            ukrainian: '烏克蘭',
            turkish: '土耳其',
            persian: '波斯語',
            polish: '波兰语',
            confirm: '确定',
            cancel: '取消',
            close: '关闭',
            upload_files: '上传文件',
            files_will_uploaded_to: '文件将上传到',
            select_files: '选择文件',
            uploading: '上传中',
            permissions: '权限',
            select_destination_folder: '选择目标文件',
            source: '源自',
            destination: '目的地',
            copy_file: '复制文件',
            sure_to_delete: '确定要删除？',
            change_name_move: '改名或移动？',
            enter_new_name_for: '输入新的名称',
            extract_item: '解压',
            extraction_started: '解压已经在后台开始',
            compression_started: '压缩已经在后台开始',
            enter_folder_name_for_extraction: '输入解压的目标文件夹',
            enter_file_name_for_compression: '输入要压缩的文件名',
            toggle_fullscreen: '切换全屏',
            edit_file: '编辑文件',
            file_content: '文件内容',
            loading: '加载中',
            search: '搜索',
            create_folder: '创建文件夹',
            create: '创建',
            folder_name: '文件夹名称',
            upload: '上传',
            change_permissions: '修改权限',
            change: '修改',
            details: '详细信息',
            icons: '图标',
            list: '列表',
            name: '名称',
            size: '尺寸',
            actions: '操作',
            date: '日期',
            selection: '选择',
            no_files_in_folder: '此文件夹没有文件',
            no_folders_in_folder: '此文件夹不包含子文件夹',
            select_this: '选择此文件',
            go_back: '后退',
            wait: '等待',
            move: '移动',
            download: '下载',
            view_item: '查看子项',
            remove: '删除',
            edit: '编辑',
            save: '编辑',
            copy: '复制',
            rename: '重命名',
            extract: '解压',
            compress: '压缩',
            error_invalid_filename: '非法文件名或文件已经存在, 请指定其它名称',
            error_modifying: '修改文件出错',
            error_deleting: '删除文件或文件夹出错',
            error_renaming: '重命名文件出错',
            error_copying: '复制文件出错',
            error_compressing: '压缩文件或文件夹出错',
            error_extracting: '解压文件出错',
            error_creating_folder: '创建文件夹出错',
            error_getting_content: '获取文件内容出错',
            error_changing_perms: '修改文件权限出错',
            error_uploading_files: '上传文件出错',
            sure_to_start_compression_with: '确定要压缩？',
            owner: '拥有者',
            group: '群组',
            others: '其他',
            read: '读取',
            write: '写入',
            exec: '执行',
            original: '原始',
            changes: '变化',
            recursive: '递归',
            preview: '成员预览',
            open: '打开',
            these_elements: '共 {{total}} 个',
            new_folder: '新文件夹',
            download_as_zip: '下载的ZIP'
        });

        $translateProvider.translations('zh_tw', {
            filemanager: '檔案管理員',
            language: '語言',
            english: '英語',
            spanish: '西班牙語',
            portuguese: '葡萄牙語',
            french: '法語',
            german: '德語',
            hebrew: '希伯來語',
            italian: '意大利',
            slovak: '斯洛伐克語',
            chinese_tw: '正體中文',
            chinese_cn: '簡體中文',
            russian: '俄語',
            ukrainian: '烏克蘭',
            turkish: '土耳其',
            persian: '波斯語',
            polish: '波蘭語',
            confirm: '確定',
            cancel: '取消',
            close: '關閉',
            upload_files: '上傳檔案',
            files_will_uploaded_to: '檔案將上傳到',
            select_files: '選擇檔案',
            uploading: '上傳中',
            permissions: '權限',
            select_destination_folder: '選擇目標檔案',
            source: '來自',
            destination: '目的地',
            copy_file: '複製檔案',
            sure_to_delete: '確定要刪除？',
            change_name_move: '更名或移動？',
            enter_new_name_for: '輸入新的名稱',
            extract_item: '解壓',
            extraction_started: '解壓已經在後台開始',
            compression_started: '壓縮已經在後台開始',
            enter_folder_name_for_extraction: '輸入解壓的目標資料匣',
            enter_file_name_for_compression: '輸入要壓縮的檔名',
            toggle_fullscreen: '切換全螢幕',
            edit_file: '編輯檔案',
            file_content: '檔案內容',
            loading: '載入中',
            search: '尋找',
            create_folder: '建立資料匣',
            create: '建立',
            folder_name: '資料匣名稱',
            upload: '上傳',
            change_permissions: '修改權限',
            change: '修改',
            details: '詳細內容',
            icons: '圖示',
            list: '列表',
            name: '名稱',
            size: '大小',
            actions: '操作',
            date: '日期',
            selection: '選擇',
            no_files_in_folder: '此資料匣沒有文件',
            no_folders_in_folder: '此資料匣不包含子資料匣',
            select_this: '選擇此資料匣',
            go_back: '後退',
            wait: '等待',
            move: '移動',
            download: '下載',
            view_item: '檢視',
            remove: '刪除',
            edit: '存檔',
            save: '存檔',
            copy: '複製',
            rename: '更改名稱',
            extract: '解壓',
            compress: '壓縮',
            error_invalid_filename: '非法檔名或檔案已經存在, 請指定其它檔名',
            error_modifying: '修改檔案出錯',
            error_deleting: '刪除檔案或資料夾出錯',
            error_renaming: '更改名稱發生出錯',
            error_copying: '複製檔案出錯',
            error_compressing: '壓縮檔案或資料匣出錯',
            error_extracting: '解壓檔案出錯',
            error_creating_folder: '建立資料匣出錯',
            error_getting_content: '獲取檔案內容出錯',
            error_changing_perms: '修改檔案權限出錯',
            error_uploading_files: '上傳檔案出錯',
            sure_to_start_compression_with: '確定要壓縮？',
            owner: '擁有者',
            group: '群組',
            others: '其他',
            read: '讀取',
            write: '寫入',
            exec: '執行',
            original: '現行',
            changes: '變更為',
            recursive: '包含所有子資料匣',
            preview: '預覽',
            open: '開啟',
            these_elements: '共 {{total}} 個',
            new_folder: '新資料匣',
            download_as_zip: '以ZIP下載'
        });

        $translateProvider.translations('ru', {
            filemanager: 'Файловый менеджер',
            language: 'Язык',
            english: 'Английский',
            spanish: 'Испанский',
            portuguese: 'Португальский',
            french: 'Французкий',
            german: 'Немецкий',
            hebrew: 'Хинди',
            italian: 'итальянский',
            slovak: 'Словацкий',
            chinese_tw: 'Традиционный Китайский',
            chinese_cn: 'Упрощенный Китайский',
            russian: 'русский',
            ukrainian: 'украинец',
            turkish: 'турецкий',
            persian: 'персидский',
            polish: 'Польский',
            confirm: 'Подьвердить',
            cancel: 'Отменить',
            close: 'Закрыть',
            upload_files: 'Загрузка файлов',
            files_will_uploaded_to: 'Файлы будут загружены в: ',
            select_files: 'Выберите файлы',
            uploading: 'Загрузка',
            permissions: 'Разрешения',
            select_destination_folder: 'Выберите папку назначения',
            source: 'Источкик',
            destination: 'Цель',
            copy_file: 'Скопировать файл',
            sure_to_delete: 'Действительно удалить?',
            change_name_move: 'Переименовать / переместить',
            enter_new_name_for: 'Новое имя для',
            extract_item: 'Извлечь',
            extraction_started: 'Извлечение начато',
            compression_started: 'Сжатие начато',
            enter_folder_name_for_extraction: 'Извлечь в укананную папку',
            enter_file_name_for_compression: 'Введите имя архива',
            toggle_fullscreen: 'На весь экран',
            edit_file: 'Редактировать',
            file_content: 'Содержимое файла',
            loading: 'Загрузка',
            search: 'Поиск',
            create_folder: 'Создать папку',
            create: 'Создать',
            folder_name: 'Имя папки',
            upload: 'Загрузить',
            change_permissions: 'Изменить разрешения',
            change: 'Изменить',
            details: 'Свойства',
            icons: 'Иконки',
            list: 'Список',
            name: 'Имя',
            size: 'Размер',
            actions: 'Действия',
            date: 'Дата',
            selection: 'выбор',
            no_files_in_folder: 'Пустая папка',
            no_folders_in_folder: 'Пустая папка',
            select_this: 'Выбрать',
            go_back: 'Назад',
            wait: 'Подождите',
            move: 'Переместить',
            download: 'Скачать',
            view_item: 'Отобразить содержимое',
            remove: 'Удалить',
            edit: 'Редактировать',
            save: 'Редактировать',
            copy: 'Скопировать',
            rename: 'Переименовать',
            extract: 'Извлечь',
            compress: 'Сжать',
            error_invalid_filename: 'Имя неверное или уже существует, выберите другое',
            error_modifying: 'Произошла ошибка при модифицировании файла',
            error_deleting: 'Произошла ошибка при удалении',
            error_renaming: 'Произошла ошибка при переименовании файла',
            error_copying: 'Произошла ошибка при копировании файла',
            error_compressing: 'Произошла ошибка при сжатии',
            error_extracting: 'Произошла ошибка при извлечении',
            error_creating_folder: 'Произошла ошибка при создании папки',
            error_getting_content: 'Произошла ошибка при получении содержимого',
            error_changing_perms: 'Произошла ошибка при изменении разрешений',
            error_uploading_files: 'Произошла ошибка при загрузке',
            sure_to_start_compression_with: 'Действительно сжать',
            owner: 'Владелец',
            group: 'Группа',
            others: 'Другие',
            read: 'Чтение',
            write: 'Запись',
            exec: 'Выполнение',
            original: 'По-умолчанию',
            changes: 'Изменения',
            recursive: 'Рекурсивно',
            preview: 'Просмотр',
            open: 'Открыть',
            these_elements: 'всего {{total}} елементов',
            new_folder: 'Новая папка',
            download_as_zip: 'Download as ZIP'
        });

        $translateProvider.translations('ua', {
            filemanager: 'Файловий менеджер',
            language: 'Мова',
            english: 'Англійська',
            spanish: 'Іспанська',
            portuguese: 'Португальська',
            french: 'Французька',
            german: 'Німецька',
            hebrew: 'Хінді',
            italian: 'італійський',
            slovak: 'Словацька',
            chinese_tw: 'традиційний Китайський',
            chinese_cn: 'Cпрощена Китайська',
            russian: 'російський',
            ukrainian: 'український',
            turkish: 'турецька',
            persian: 'перський',
            polish: 'Польська',
            confirm: 'Підтвердити',
            cancel: 'Відмінити',
            close: 'Закрити',
            upload_files: 'Завантаження файлів',
            files_will_uploaded_to: 'Файли будуть завантажені у: ',
            select_files: 'Виберіть файли',
            uploading: 'Завантаження',
            permissions: 'Дозволи',
            select_destination_folder: 'Виберіть папку призначення',
            source: 'Джерело',
            destination: 'Ціль',
            copy_file: 'Скопіювати файл',
            sure_to_delete: 'Дійсно удалить?',
            change_name_move: 'Перейменувати / перемістити',
            enter_new_name_for: 'Нове ім\'я для',
            extract_item: 'Извлечь',
            extraction_started: 'Извлечение начато',
            compression_started: 'Архівацію почато',
            enter_folder_name_for_extraction: 'Извлечь в укананную папку',
            enter_file_name_for_compression: 'Введите имя архива',
            toggle_fullscreen: 'На весь экран',
            edit_file: 'Редагувати',
            file_content: 'Вміст файлу',
            loading: 'Завантаження',
            search: 'Пошук',
            create_folder: 'Створити папку',
            create: 'Створити',
            folder_name: 'Ім\'я  папки',
            upload: 'Завантижити',
            change_permissions: 'Змінити дозволи',
            change: 'Редагувати',
            details: 'Властивості',
            icons: 'Іконки',
            list: 'Список',
            name: 'Ім\'я',
            size: 'Розмір',
            actions: 'Дії',
            date: 'Дата',
            selection: 'вибір',
            no_files_in_folder: 'Пуста папка',
            no_folders_in_folder: 'Пуста папка',
            select_this: 'Выбрати',
            go_back: 'Назад',
            wait: 'Зачекайте',
            move: 'Перемістити',
            download: 'Скачати',
            view_item: 'Показати вміст',
            remove: 'Видалити',
            edit: 'Редагувати',
            save: 'Редагувати',
            copy: 'Копіювати',
            rename: 'Переіменувати',
            extract: 'Розархівувати',
            compress: 'Архівувати',
            error_invalid_filename: 'Ім\'я певірне або вже існує, виберіть інше',
            error_modifying: 'Виникла помилка при редагуванні файлу',
            error_deleting: 'Виникла помилка при видаленні',
            error_renaming: 'Виникла помилка при зміні імені файлу',
            error_copying: 'Виникла помилка при коміюванні файлу',
            error_compressing: 'Виникла помилка при стисненні',
            error_extracting: 'Виникла помилка при розархівації',
            error_creating_folder: 'Виникла помилка при створенні папки',
            error_getting_content: 'Виникла помилка при отриманні вмісту',
            error_changing_perms: 'Виникла помилка при зміні дозволів',
            error_uploading_files: 'Виникла помилка при завантаженні',
            sure_to_start_compression_with: 'Дійсно стиснути',
            owner: 'Власник',
            group: 'Група',
            others: 'Інші',
            read: 'Читання',
            write: 'Запис',
            exec: 'Виконання',
            original: 'За замовчуванням',
            changes: 'Зміни',
            recursive: 'Рекурсивно',
            preview: 'Перегляд',
            open: 'Відкрити',
            these_elements: 'усього {{total}} елементів',
            new_folder: 'Нова папка',
            download_as_zip: 'Download as ZIP'
        });

        $translateProvider.translations('tr', {
            filemanager: 'Dosya Yöneticisi',
            language: 'Dil',
            english: 'İngilizce',
            spanish: 'İspanyolca',
            portuguese: 'Portekizce',
            french: 'Fransızca',
            german: 'Almanca',
            hebrew: 'İbranice',
            italian: 'İtalyanca',
            slovak: 'Slovakça',
            chinese_tw: 'Geleneksel Çin',
            chinese_cn: 'Basitleştirilmiş Çince',
            russian: 'Rusça',
            ukrainian: 'Ukraynaca',
            turkish: 'Türkçe',
            persian: 'Farsça',
            polish: 'Lehçe',
            confirm: 'Onayla',
            cancel: 'İptal Et',
            close: 'Kapat',
            upload_files: 'Dosya yükle',
            files_will_uploaded_to: 'Dosyalar yüklenecektir.',
            select_files: 'Dosya Seç',
            uploading: 'Yükleniyor',
            permissions: 'İzinler',
            select_destination_folder: 'Hedef klasör seçin',
            source: 'Kaynak',
            destination: 'Hedef',
            copy_file: 'Dosyayı kopyala',
            sure_to_delete: 'Silmek istediğinden emin misin',
            change_name_move: 'İsmini değiştir / taşı',
            enter_new_name_for: 'Yeni ad girin',
            extract_item: 'Dosya çıkar',
            extraction_started: 'Çıkarma işlemi arkaplanda devam ediyor',
            compression_started: 'Sıkıştırma işlemi arkaplanda başladı',
            enter_folder_name_for_extraction: 'Çıkarılması için klasör adı girin',
            enter_file_name_for_compression: 'Sıkıştırılması için dosya adı girin',
            toggle_fullscreen: 'Tam ekran moduna geç',
            edit_file: 'Dosyayı düzenle',
            file_content: 'Dosya içeriği',
            loading: 'Yükleniyor',
            search: 'Ara',
            create_folder: 'Klasör oluştur',
            create: 'Oluştur',
            folder_name: 'Klasör adı',
            upload: 'Yükle',
            change_permissions: 'İzinleri değiştir',
            change: 'Değiştir',
            details: 'Detaylar',
            icons: 'simgeler',
            list: 'Liste',
            name: 'Adı',
            size: 'Boyutu',
            actions: 'İşlemler',
            date: 'Tarih',
            selection: 'Seçim',
            no_files_in_folder: 'Klasörde hiç dosya yok',
            no_folders_in_folder: 'Bu klasör alt klasör içermez',
            select_this: 'Bunu seç',
            go_back: 'Geri git',
            wait: 'Bekle',
            move: 'Taşı',
            download: 'İndir',
            view_item: 'Dosyayı görüntüle',
            remove: 'Sil',
            edit: 'Düzenle',
            save: 'Düzenle',
            copy: 'Kopyala',
            rename: 'Yeniden Adlandır',
            extract: 'Çıkart',
            compress: 'Sıkıştır',
            error_invalid_filename: 'Geçersiz dosya adı, bu dosya adına sahip dosya mevcut',
            error_modifying: 'Dosya düzenlenirken bir hata oluştu',
            error_deleting: 'Klasör veya dosya silinirken bir hata oluştu',
            error_renaming: 'Dosya yeniden adlandırılırken bir hata oluştu',
            error_copying: 'Dosya kopyalanırken bir hata oluştu',
            error_compressing: 'Dosya veya klasör sıkıştırılırken bir hata oluştu',
            error_extracting: 'Çıkartılırken bir hata oluştu',
            error_creating_folder: 'Klasör oluşturulurken bir hata oluştu',
            error_getting_content: 'Dosya detayları alınırken bir hata oluştu',
            error_changing_perms: 'Dosyanın izini değiştirilirken bir hata oluştu',
            error_uploading_files: 'Dosyalar yüklenirken bir hata oluştu',
            sure_to_start_compression_with: 'Sıkıştırmak istediğinden emin misin',
            owner: 'Sahip',
            group: 'Grup',
            others: 'Diğerleri',
            read: 'Okuma',
            write: 'Yazma',
            exec: 'Gerçekleştir',
            original: 'Orjinal',
            changes: 'Değişiklikler',
            recursive: 'Yinemeli',
            preview: 'Dosyayı önizle',
            open: 'Aç',
            these_elements: '{{total}} eleman',
            new_folder: 'Yeni Klasör',
            download_as_zip: 'ZIP olarak indir'
        });

        $translateProvider.translations('fa', {
            filemanager: 'مدیریت فایل ها',
            language: 'زبان',
            english: 'انگلیسی',
            spanish: 'اسپانیایی',
            portuguese: 'پرتغالی',
            french: 'فرانسه',
            german: 'آلمانی',
            hebrew: 'عبری',
            italian: 'ایتالیایی',
            slovak: 'اسلواک',
            chinese_tw: 'چینی سنتی',
            chinese_cn: 'چینی ساده شده',
            russian: 'روسی',
            ukrainian: 'اوکراینی',
            turkish: 'ترکی',
            persian: 'فارسی',
            polish: 'لهستانی',
            confirm: 'تایید',
            cancel: 'رد',
            close: 'بستن',
            upload_files: 'آپلود فایل',
            files_will_uploaded_to: 'فایل ها آپلود می شوند به',
            select_files: 'انتخاب فایل ها',
            uploading: 'در حال آپلود',
            permissions: 'مجوز ها',
            select_destination_folder: 'پوشه مقصد را انتخاب کنید',
            source: 'مبدا',
            destination: 'مقصد',
            copy_file: 'کپی فایل',
            sure_to_delete: 'مطمين هستید می خواهید حذف کنید؟',
            change_name_move: 'تغییر نام و جابجایی',
            enter_new_name_for: 'نام جدیدی وارد کنید برای',
            extract_item: 'خارج کردن از حالت فشرده',
            extraction_started: 'یک پروسه در پس زمینه شروع به خارج کردن از حالت فشرده کرد',
            compression_started: 'یک پروسه در پس زمینه شروع به فشرده سازی کرد',
            enter_folder_name_for_extraction: 'نام پوشه مقصد برای خارج کردن از حالت فشرده را وارد کنید',
            enter_file_name_for_compression: 'نام پوشه مقصد برای فشرده سازی را وارد کنید',
            toggle_fullscreen: 'تعویض حالت تمام صفحه',
            edit_file: 'ویرایش',
            file_content: 'محتویات',
            loading: 'در حال بارگذاری',
            search: 'جستجو',
            create_folder: 'پوشه جدید',
            create: 'ساختن',
            folder_name: 'نام پوشه',
            upload: 'آپلود',
            change_permissions: 'تغییر مجوز ها',
            change: 'تغییر',
            details: 'جزییات',
            icons: 'آیکون ها',
            list: 'لیست',
            name: 'نام',
            size: 'سایز',
            actions: 'اعمال',
            date: 'تاریخ',
            selection: 'انتخاب',
            no_files_in_folder: 'هیچ فایلی در این پوشه نیست',
            no_folders_in_folder: 'هیچ پوشه ای داخل این پوشه قرار ندارد',
            select_this: 'انتخاب',
            go_back: 'بازگشت',
            wait: 'منتظر بمانید',
            move: 'جابجایی',
            download: 'دانلود',
            view_item: 'مشاهده این مورد',
            remove: 'حذف',
            edit: 'ویرایش',
            save: 'ویرایش',
            copy: 'کپی',
            rename: 'تغییر نام',
            extract: 'خروج از حالت فشرده',
            compress: 'فشرده سازی',
            error_invalid_filename: 'نام فایل مورد درست نیست و یا قبلا استفاده شده است، لطفا نام دیگری وارد کنید',
            error_modifying: 'در هنگام تغییر فایل خطایی پیش آمد',
            error_deleting: 'در هنگام حذف فایل خطایی پیش آمد',
            error_renaming: 'در هنگام تغییر نام فایل خطایی پیش آمد',
            error_copying: 'در هنگام کپی کردن فایل خطایی پیش آمد',
            error_compressing: 'در هنگام فشرده سازی فایل خطایی پیش آمد',
            error_extracting: 'در هنگام خارک کردن فایل از حالت فشرده خطایی پیش آمد',
            error_creating_folder: 'در هنگام ساخت پوشه خطایی پیش امد',
            error_getting_content: 'در هنگام بارگذاری محتویات فایل خطایی رخ داد',
            error_changing_perms: 'در هنگام تغییر مجوز های فایل خطایی رخ داد',
            error_uploading_files: 'در آپلود فایل خطایی رخ داد',
            sure_to_start_compression_with: 'مطمئن هستید فشرده سازی انجام شد؟',
            owner: 'مالک فایل',
            group: 'گروه',
            others: 'دیگران',
            read: 'خواندن',
            write: 'نوشتن',
            exec: 'اجرا کردن',
            original: 'اصلی',
            changes: 'تغییرات',
            recursive: 'بازگشتی',
            preview: 'پیش نمایش',
            open: 'باز کردن',
            these_elements: 'تعداد {{total}} مورد',
            new_folder: 'پوشه جدید',
            download_as_zip: 'به عنوان فایل فشرده دانلود شود'
        });

        $translateProvider.translations('pl', {
            filemanager: 'Menadżer plików',
            language: 'Język',
            english: 'Angielski',
            spanish: 'Hiszpański',
            portuguese: 'Portugalski',
            french: 'Francuski',
            german: 'Niemiecki',
            hebrew: 'Hebrajski',
            italian: 'Włoski',
            slovak: 'Słowacki',
            chinese_tw: 'Tradycyjny Chiński',
            chinese_cn: 'Chiński Uproszczony',
            russian: 'Rosyjski',
            ukrainian: 'Ukraiński',
            turkish: 'Turecki',
            persian: 'Perski',
            polish: 'Polski',
            confirm: 'Potwierdź',
            cancel: 'Anuluj',
            close: 'Zamknij',
            upload_files: 'Wgraj pliki',
            files_will_uploaded_to: 'Pliki będą umieszczone w katalogu',
            select_files: 'Wybierz pliki',
            uploading: 'Ładowanie',
            permissions: 'Uprawnienia',
            select_destination_folder: 'Wybierz folder docelowy',
            source: 'Źródło',
            destination: 'Cel',
            copy_file: 'Kopiuj plik',
            sure_to_delete: 'Jesteś pewien, że chcesz skasować',
            change_name_move: 'Zmień nazwę / przenieś',
            enter_new_name_for: 'Wpisz nową nazwę dla',
            extract_item: 'Rozpakuj element',
            extraction_started: 'Rozpakowywanie rozpoczęło się w tle',
            compression_started: 'Kompresowanie rozpoczęło się w tle',
            enter_folder_name_for_extraction: 'Wpisz nazwę folderu do rozpakowania',
            enter_file_name_for_compression: 'Wpisz nazwę folderu do skompresowania',
            toggle_fullscreen: 'Tryb pełnoekranowy',
            edit_file: 'Edytuj plik',
            file_content: 'Zawartość pliku',
            loading: 'Ładowanie',
            search: 'Szukaj',
            create_folder: 'Stwórz folder',
            create: 'Utwórz',
            folder_name: 'Nazwa folderu',
            upload: 'Wgraj',
            change_permissions: 'Zmień uprawnienia',
            change: 'Zmień',
            details: 'Szczegóły',
            icons: 'Ikony',
            list: 'Lista',
            name: 'Nazwa',
            size: 'Rozmiar',
            actions: 'Akcje',
            date: 'Data',
            selection: 'Zaznaczone',
            no_files_in_folder: 'Brak plików w tym folderze',
            no_folders_in_folder: 'Ten folder nie zawiera podfolderów',
            select_this: 'Wybierz ten',
            go_back: 'W górę',
            wait: 'Wait',
            move: 'Przenieś',
            download: 'Pobierz',
            view_item: 'Wyświetl',
            remove: 'Usuń',
            edit: 'Edycja',
            save: 'Edycja',
            copy: 'Kopiuj',
            rename: 'Zmień nazwę',
            extract: 'Rozpakuj',
            compress: 'Skompresuj',
            error_invalid_filename: 'Błędna nazwa pliku lub plik o takiej nazwie już istnieje, proszę użyć innej nazwy',
            error_modifying: 'Wystąpił błąd podczas modyfikowania pliku',
            error_deleting: 'Wystąpił błąd podczas usuwania pliku lub folderu',
            error_renaming: 'Wystąpił błąd podczas zmiany nazwy pliku',
            error_copying: 'Wystąpił błąd podczas kopiowania pliku',
            error_compressing: 'Wystąpił błąd podczas kompresowania pliku lub folderu',
            error_extracting: 'Wystąpił błąd podczas rozpakowywania pliku',
            error_creating_folder: 'Wystąpił błąd podczas tworzenia nowego folderu',
            error_getting_content: 'Wystąpił błąd podczas pobierania zawartości pliku',
            error_changing_perms: 'Wystąpił błąd podczas zmiany uprawnień pliku',
            error_uploading_files: 'Wystąpił błąd podczas wgrywania plików',
            sure_to_start_compression_with: 'Jesteś pewien, że chcesz skompresować',
            owner: 'Właściciel',
            group: 'Grupa',
            others: 'Inni',
            read: 'Odczyt',
            write: 'Zapis',
            exec: 'Wykonywanie',
            original: 'Oryginał',
            changes: 'Zmiany',
            recursive: 'Rekursywnie',
            preview: 'Podgląd elementu',
            open: 'Otwórz',
            these_elements: 'te {{total}} elementy?',
            new_folder: 'Nowy folder',
            download_as_zip: 'Pobierz jako ZIP'
        });

        $translateProvider.translations('it', {
            filemanager: 'Gestore File',
            language: 'Lingua',
            english: 'Inglese',
            spanish: 'Spagnolo',
            portuguese: 'Portoghese',
            french: 'Francese',
            german: 'Tedesco',
            hebrew: 'Ebraico',
            slovak: 'Slovacco',
            chinese_tw: 'Cinese Tradizionale',
            chinese_cn: 'Cinese',
            russian: 'Russo',
            ukrainian: 'Ucraino',
            turkish: 'Turco',
            persian: 'Persiano',
            polish: 'Polacco',
            confirm: 'Conferma',
            cancel: 'Annulla',
            close: 'Chiudi',
            upload_files: 'Carica files',
            files_will_uploaded_to: 'I files saranno caricati in',
            select_files: 'Seleziona i files',
            uploading: 'Trasferimento',
            permissions: 'Permessi',
            select_destination_folder: 'Select carterlla di destinazione',
            source: 'Sorgente',
            destination: 'Destinazione',
            copy_file: 'Copia file',
            sure_to_delete: 'Sicuro di voler eliminare',
            change_name_move: 'Rinomina / sposta',
            enter_new_name_for: 'Inserisci nuovo nome per',
            extract_item: 'Estrai elemento',
            extraction_started: 'Decompressione avviata da un processo in background',
            compression_started: 'Compressione avviata da un processo in background',
            enter_folder_name_for_extraction: 'Inserisci nome cartella per l\'estrazione di',
            enter_file_name_for_compression: 'Inserisci nome file per la compressione di',
            toggle_fullscreen: 'Passa a schermo intero',
            edit_file: 'Modifica file',
            file_content: 'Contenuto del file',
            loading: 'Caricamento',
            search: 'Cerca',
            create_folder: 'Crea cartella',
            create: 'Crea',
            folder_name: 'Nome cartella',
            upload: 'Upload',
            change_permissions: 'Modifica permessi',
            change: 'Modifica',
            details: 'Dettagli',
            icons: 'Icone',
            list: 'Lista',
            name: 'Nome',
            size: 'Dimensione',
            actions: 'Azioni',
            date: 'Data',
            selection: 'Selezione',
            no_files_in_folder: 'Nessun file nella cartella',
            no_folders_in_folder: 'Questa cartella non contiene altre cartelle',
            select_this: 'Seleziona questo',
            go_back: 'Indietro',
            wait: 'Attendere',
            move: 'Sposta',
            download: 'Scarica',
            view_item: 'Visualizza elemento',
            remove: 'Elimina',
            edit: 'Modifica',
            save: 'Modifica',
            copy: 'Copia',
            rename: 'Rinomina',
            extract: 'Estrai',
            compress: 'Comprimi',
            error_invalid_filename: 'Nome file non valido o già esistente, specificarne un\'altro',
            error_modifying: 'Errore durante la modifica del file',
            error_deleting: 'Errore durante l\'eliminazione del file o della cartella',
            error_renaming: 'Errore durante la rinomina del file',
            error_copying: 'Errore durante la copia del file',
            error_compressing: 'Errore durante la compressione del file o della cartella',
            error_extracting: 'Errore durante l\'estrazione del file',
            error_creating_folder: 'Errore nella creazione della cartella',
            error_getting_content: 'Errore nel recupero del contenuto del file',
            error_changing_perms: 'Errore durante la modifica dei permessi del file',
            error_uploading_files: 'Errore durante il trasferimento dei files',
            sure_to_start_compression_with: 'Sicuro di voler comprimere',
            owner: 'Proprietario',
            group: 'Gruppo',
            others: 'Altri',
            read: 'Lettura',
            write: 'Scrittura',
            exec: 'Esecuzione',
            original: 'Originario',
            changes: 'Cambiamenti',
            recursive: 'Ricorsivo',
            preview: 'Anteprima',
            open: 'Apri',
            these_elements: 'questi {{total}} elementi',
            new_folder: 'Nuova cartella',
            download_as_zip: 'Scarica come file ZIP'
        });

    }]);
})(angular);
(function (angular) {
    'use strict';
    var app = angular.module('FileManagerApp');

    app.filter('strLimit', ['$filter', function ($filter) {
        return function (input, limit, more) {
            if (input.length <= limit) {
                return input;
            }
            return $filter('limitTo')(input, limit) + (more || '...');
        };
    }]);

    app.filter('fileExtension', ['$filter', function ($filter) {
        return function (input) {
            return /\./.test(input) && $filter('strLimit')(input.split('.').pop(), 3, '..') || '';
        };
    }]);

    app.filter('formatDate', ['$filter', function () {
        return function (input) {
            return input instanceof Date ?
                input.toISOString().substring(0, 19).replace('T', ' ') :
                (input.toLocaleString || input.toString).apply(input);
        };
    }]);

    app.filter('humanReadableFileSize', ['$filter', 'fileManagerConfig', function ($filter, fileManagerConfig) {
        // See https://en.wikipedia.org/wiki/Binary_prefix
        var decimalByteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
        var binaryByteUnits = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

        return function (input) {
            var i = -1;
            var fileSizeInBytes = input;

            do {
                fileSizeInBytes = fileSizeInBytes / 1024;
                i++;
            } while (fileSizeInBytes > 1024);

            var result = fileManagerConfig.useBinarySizePrefixes ? binaryByteUnits[i] : decimalByteUnits[i];
            return Math.max(fileSizeInBytes, 0.1).toFixed(1) + ' ' + result;
        };
    }]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('apiHandler', ['$http', '$q', '$window', '$translate', '$httpParamSerializer', 'Upload',
        function ($http, $q, $window, $translate, $httpParamSerializer, Upload) {

            $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

            var ApiHandler = function () {
                this.inprocess = false;
                this.asyncSuccess = false;
                this.error = '';
            };

            ApiHandler.prototype.deferredHandler = function (data, deferred, code, defaultMsg) {
                if (!data || typeof data !== 'object') {
                    this.error = 'Error %s - Bridge response error, please check the API docs or this ajax response.'.replace('%s', code);
                }
                if (code == 404) {
                    this.error = 'Error 404 - Backend bridge is not working, please check the ajax response.';
                }
                if (data.result && data.result.error) {
                    this.error = data.result.error;
                }
                if (!this.error && data.error) {
                    this.error = data.error.message;
                }
                if (!this.error && defaultMsg) {
                    this.error = defaultMsg;
                }
                if (this.error) {
                    return deferred.reject(data);
                }
                return deferred.resolve(data);
            };

            ApiHandler.prototype.list = function (apiUrl, path, customDeferredHandler, exts) {
                var self = this;
                var dfHandler = customDeferredHandler || self.deferredHandler;
                var deferred = $q.defer();
                var data = {
                    action: 'list',
                    path: path,
                    fileExtensions: exts && exts.length ? exts : undefined
                };

                self.inprocess = true;
                self.error = '';

                $http.post(apiUrl, data).then(function (response) {
                    dfHandler(response.data, deferred, response.status);
                }, function (response) {
                    dfHandler(response.data, deferred, response.status, 'Unknown error listing, check the response');
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.copy = function (apiUrl, items, path, singleFilename) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'copy',
                    items: items,
                    newPath: path
                };

                if (singleFilename && items.length === 1) {
                    data.singleFilename = singleFilename;
                }

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_copying'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.move = function (apiUrl, items, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'move',
                    items: items,
                    newPath: path
                };
                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_moving'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.remove = function (apiUrl, items) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'remove',
                    items: items
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_deleting'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.upload = function (apiUrl, destination, files) {
                var self = this;
                var deferred = $q.defer();
                self.inprocess = true;
                self.progress = 0;
                self.error = '';

                var data = {
                    destination: destination
                };

                for (var i = 0; i < files.length; i++) {
                    data['file-' + i] = files[i];
                }

                if (files && files.length) {
                    Upload.upload({
                        url: apiUrl,
                        data: data
                    }).then(function (data) {
                        self.deferredHandler(data.data, deferred, data.status);
                    }, function (data) {
                        self.deferredHandler(data.data, deferred, data.status, 'Unknown error uploading files');
                    }, function (evt) {
                        self.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total)) - 1;
                    })['finally'](function () {
                        self.inprocess = false;
                        self.progress = 0;
                    });
                }

                return deferred.promise;
            };

            ApiHandler.prototype.getContent = function (apiUrl, itemPath) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'getContent',
                    item: itemPath
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_getting_content'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.edit = function (apiUrl, itemPath, content) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'edit',
                    item: itemPath,
                    content: content
                };

                self.inprocess = true;
                self.error = '';

                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_modifying'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.rename = function (apiUrl, itemPath, newPath) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'rename',
                    item: itemPath,
                    newItemPath: newPath
                };
                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_renaming'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.getUrl = function (apiUrl, path) {
                var data = {
                    action: 'download',
                    path: path
                };
                return path && [apiUrl, $httpParamSerializer(data)].join('?');
            };

            ApiHandler.prototype.download = function (apiUrl, itemPath, toFilename, downloadByAjax, forceNewWindow) {
                var self = this;
                var url = this.getUrl(apiUrl, itemPath);

                if (!downloadByAjax || forceNewWindow || !$window.saveAs) {
                    !$window.saveAs && $window.console.log('Your browser dont support ajax download, downloading by default');
                    return !!$window.open(url, '_blank', '');
                }

                var deferred = $q.defer();
                self.inprocess = true;
                $http.get(url).then(function (response) {
                    var bin = new $window.Blob([response.data]);
                    deferred.resolve(response.data);
                    $window.saveAs(bin, toFilename);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_downloading'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.downloadMultiple = function (apiUrl, items, toFilename, downloadByAjax, forceNewWindow) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'downloadMultiple',
                    items: items,
                    toFilename: toFilename
                };
                var url = [apiUrl, $httpParamSerializer(data)].join('?');

                if (!downloadByAjax || forceNewWindow || !$window.saveAs) {
                    !$window.saveAs && $window.console.log('Your browser dont support ajax download, downloading by default');
                    return !!$window.open(url, '_blank', '');
                }

                self.inprocess = true;
                $http.get(apiUrl).then(function (response) {
                    var bin = new $window.Blob([response.data]);
                    deferred.resolve(response.data);
                    $window.saveAs(bin, toFilename);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_downloading'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.compress = function (apiUrl, items, compressedFilename, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'compress',
                    items: items,
                    destination: path,
                    compressedFilename: compressedFilename
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_compressing'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.extract = function (apiUrl, item, folderName, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'extract',
                    item: item,
                    destination: path,
                    folderName: folderName
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_extracting'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.changePermissions = function (apiUrl, items, permsOctal, permsCode, recursive) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'changePermissions',
                    items: items,
                    perms: permsOctal,
                    permsCode: permsCode,
                    recursive: !!recursive
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_changing_perms'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.createFolder = function (apiUrl, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'createFolder',
                    newPath: path
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_creating_folder'));
                })['finally'](function () {
                    self.inprocess = false;
                });

                return deferred.promise;
            };

            return ApiHandler;

        }
    ]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('apiMiddleware', ['$window', 'fileManagerConfig', 'apiHandler',
        function ($window, fileManagerConfig, ApiHandler) {

            var ApiMiddleware = function () {
                this.apiHandler = new ApiHandler();
            };

            ApiMiddleware.prototype.getPath = function (arrayPath) {
                return '/' + arrayPath.join('/');
            };

            ApiMiddleware.prototype.getFileList = function (files) {
                return (files || []).map(function (file) {
                    return file && file.model.fullPath();
                });
            };

            ApiMiddleware.prototype.getFilePath = function (item) {
                return item && item.model.fullPath();
            };

            ApiMiddleware.prototype.list = function (path, customDeferredHandler) {
                return this.apiHandler.list(fileManagerConfig.listUrl, this.getPath(path), customDeferredHandler);
            };

            ApiMiddleware.prototype.copy = function (files, path) {
                var items = this.getFileList(files);
                var singleFilename = items.length === 1 ? files[0].tempModel.name : undefined;
                return this.apiHandler.copy(fileManagerConfig.copyUrl, items, this.getPath(path), singleFilename);
            };

            ApiMiddleware.prototype.move = function (files, path) {
                var items = this.getFileList(files);
                return this.apiHandler.move(fileManagerConfig.moveUrl, items, this.getPath(path));
            };

            ApiMiddleware.prototype.remove = function (files) {
                var items = this.getFileList(files);
                return this.apiHandler.remove(fileManagerConfig.removeUrl, items);
            };

            ApiMiddleware.prototype.upload = function (files, path) {
                if (!$window.FormData) {
                    throw new Error('Unsupported browser version');
                }

                var destination = this.getPath(path);

                return this.apiHandler.upload(fileManagerConfig.uploadUrl, destination, files);
            };

            ApiMiddleware.prototype.getContent = function (item) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.getContent(fileManagerConfig.getContentUrl, itemPath);
            };

            ApiMiddleware.prototype.edit = function (item) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.edit(fileManagerConfig.editUrl, itemPath, item.tempModel.content);
            };

            ApiMiddleware.prototype.rename = function (item) {
                var itemPath = this.getFilePath(item);
                var newPath = item.tempModel.fullPath();

                return this.apiHandler.rename(fileManagerConfig.renameUrl, itemPath, newPath);
            };

            ApiMiddleware.prototype.getUrl = function (item) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.getUrl(fileManagerConfig.downloadFileUrl, itemPath);
            };

            ApiMiddleware.prototype.download = function (item, forceNewWindow) {
                //TODO: add spinner to indicate file is downloading
                var itemPath = this.getFilePath(item);
                var toFilename = item.model.name;

                if (item.isFolder()) {
                    return;
                }

                return this.apiHandler.download(
                    fileManagerConfig.downloadFileUrl,
                    itemPath,
                    toFilename,
                    fileManagerConfig.downloadFilesByAjax,
                    forceNewWindow
                );
            };

            ApiMiddleware.prototype.downloadMultiple = function (files, forceNewWindow) {
                var items = this.getFileList(files);
                var timestamp = new Date().getTime().toString().substr(8, 13);
                var toFilename = timestamp + '-' + fileManagerConfig.multipleDownloadFileName;

                return this.apiHandler.downloadMultiple(
                    fileManagerConfig.downloadMultipleUrl,
                    items,
                    toFilename,
                    fileManagerConfig.downloadFilesByAjax,
                    forceNewWindow
                );
            };

            ApiMiddleware.prototype.compress = function (files, compressedFilename, path) {
                var items = this.getFileList(files);
                return this.apiHandler.compress(fileManagerConfig.compressUrl, items, compressedFilename, this.getPath(path));
            };

            ApiMiddleware.prototype.extract = function (item, folderName, path) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.extract(fileManagerConfig.extractUrl, itemPath, folderName, this.getPath(path));
            };

            ApiMiddleware.prototype.changePermissions = function (files, dataItem) {
                var items = this.getFileList(files);
                var code = dataItem.tempModel.perms.toCode();
                var octal = dataItem.tempModel.perms.toOctal();
                var recursive = !!dataItem.tempModel.recursive;

                return this.apiHandler.changePermissions(fileManagerConfig.permissionsUrl, items, code, octal, recursive);
            };

            ApiMiddleware.prototype.createFolder = function (item) {
                var path = item.tempModel.fullPath();
                return this.apiHandler.createFolder(fileManagerConfig.createFolderUrl, path);
            };

            return ApiMiddleware;

        }
    ]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('fileNavigator', [
        'apiMiddleware', 'fileManagerConfig', 'item',
        function (ApiMiddleware, fileManagerConfig, Item) {

            var FileNavigator = function () {
                this.apiMiddleware = new ApiMiddleware();
                this.requesting = false;
                this.fileList = [];
                this.currentPath = this.getBasePath();
                this.history = [];
                this.error = '';

                this.onRefresh = function () {};
            };

            FileNavigator.prototype.getBasePath = function () {
                var path = (fileManagerConfig.basePath || '').replace(/^\//, '');
                return path.trim() ? path.split('/') : [];
            };

            FileNavigator.prototype.deferredHandler = function (data, deferred, code, defaultMsg) {
                if (!data || typeof data !== 'object') {
                    this.error = 'Error %s - Bridge response error, please check the API docs or this ajax response.'.replace('%s', code);
                }
                if (code == 404) {
                    this.error = 'Error 404 - Backend bridge is not working, please check the ajax response.';
                }
                if (code == 200) {
                    this.error = null;
                }
                if (!this.error && data.result && data.result.error) {
                    this.error = data.result.error;
                }
                if (!this.error && data.error) {
                    this.error = data.error.message;
                }
                if (!this.error && defaultMsg) {
                    this.error = defaultMsg;
                }
                if (this.error) {
                    return deferred.reject(data);
                }
                return deferred.resolve(data);
            };

            FileNavigator.prototype.list = function () {
                return this.apiMiddleware.list(this.currentPath, this.deferredHandler.bind(this));
            };

            FileNavigator.prototype.refresh = function () {
                var self = this;
                if (!self.currentPath.length) {
                    self.currentPath = this.getBasePath();
                }
                var path = self.currentPath.join('/');
                self.requesting = true;
                self.fileList = [];
                return self.list().then(function (data) {
                    self.fileList = (data.result || []).map(function (file) {
                        return new Item(file, self.currentPath);
                    });
                    self.buildTree(path);
                    self.onRefresh();
                }).finally(function () {
                    self.requesting = false;
                });
            };

            FileNavigator.prototype.buildTree = function (path) {
                var flatNodes = [],
                    selectedNode = {};

                function recursive(parent, item, path) {
                    var absName = path ? (path + '/' + item.model.name) : item.model.name;
                    if (parent.name && parent.name.trim() && path.trim().indexOf(parent.name) !== 0) {
                        parent.nodes = [];
                    }
                    if (parent.name !== path) {
                        parent.nodes.forEach(function (nd) {
                            recursive(nd, item, path);
                        });
                    } else {
                        for (var e in parent.nodes) {
                            if (parent.nodes[e].name === absName) {
                                return;
                            }
                        }
                        parent.nodes.push({
                            item: item,
                            name: absName,
                            nodes: []
                        });
                    }

                    parent.nodes = parent.nodes.sort(function (a, b) {
                        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() === b.name.toLowerCase() ? 0 : 1;
                    });
                }

                function flatten(node, array) {
                    array.push(node);
                    for (var n in node.nodes) {
                        flatten(node.nodes[n], array);
                    }
                }

                function findNode(data, path) {
                    return data.filter(function (n) {
                        return n.name === path;
                    })[0];
                }

                //!this.history.length && this.history.push({name: '', nodes: []});
                !this.history.length && this.history.push({
                    name: this.getBasePath()[0] || '',
                    nodes: []
                });
                flatten(this.history[0], flatNodes);
                selectedNode = findNode(flatNodes, path);
                selectedNode && (selectedNode.nodes = []);

                for (var o in this.fileList) {
                    var item = this.fileList[o];
                    item instanceof Item && item.isFolder() && recursive(this.history[0], item, path);
                }
            };

            FileNavigator.prototype.folderClick = function (item) {
                this.currentPath = [];
                if (item && item.isFolder()) {
                    this.currentPath = item.model.fullPath().split('/').splice(1);
                }
                this.refresh();
            };

            FileNavigator.prototype.upDir = function () {
                if (this.currentPath[0]) {
                    this.currentPath = this.currentPath.slice(0, -1);
                    this.refresh();
                }
            };

            FileNavigator.prototype.goTo = function (index) {
                this.currentPath = this.currentPath.slice(0, index + 1);
                this.refresh();
            };

            FileNavigator.prototype.fileNameExists = function (fileName) {
                return this.fileList.find(function (item) {
                    return fileName && item.model.name.trim() === fileName.trim();
                });
            };

            FileNavigator.prototype.listHasFolders = function () {
                return this.fileList.find(function (item) {
                    return item.model.type === 'dir';
                });
            };

            FileNavigator.prototype.getCurrentFolderName = function () {
                return this.currentPath.slice(-1)[0] || '/';
            };

            return FileNavigator;
        }
    ]);
})(angular);
angular.module('FileManagerApp').run(['$templateCache', function($templateCache) {$templateCache.put('src/templates/current-folder-breadcrumb.html','<ol class="breadcrumb">\r\n    <li>\r\n        <a href="" ng-click="fileNavigator.goTo(-1)">\r\n            {{"filemanager" | translate}}\r\n        </a>\r\n    </li>\r\n    <li ng-repeat="(key, dir) in fileNavigator.currentPath track by key" ng-class="{\'active\':$last}" class="animated fast fadeIn">\r\n        <a href="" ng-show="!$last" ng-click="fileNavigator.goTo(key)">\r\n            {{dir | strLimit : 8}}\r\n        </a>\r\n        <span ng-show="$last">\r\n            {{dir | strLimit : 12}}\r\n        </span>\r\n    </li>\r\n</ol>');
$templateCache.put('src/templates/item-context-menu.html','<div id="context-menu" class="dropdown clearfix animated fast fadeIn">\r\n    <ul class="dropdown-menu dropdown-right-click" role="menu" aria-labelledby="dropdownMenu" ng-show="temps.length">\r\n\r\n        <li ng-show="singleSelection() && singleSelection().isFolder()">\r\n            <a href="" tabindex="-1" ng-click="smartClick(singleSelection())">\r\n                <i class="glyphicon glyphicon-folder-open"></i> {{\'open\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.pickCallback && singleSelection() && singleSelection().isSelectable()">\r\n            <a href="" tabindex="-1" ng-click="config.pickCallback(singleSelection().model)">\r\n                <i class="glyphicon glyphicon-hand-up"></i> {{\'select_this\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.download && !selectionHas(\'dir\') && singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="download()">\r\n                <i class="glyphicon glyphicon-cloud-download"></i> {{\'download\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.downloadMultiple && !selectionHas(\'dir\') && !singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="download()">\r\n                <i class="glyphicon glyphicon-cloud-download"></i> {{\'download_as_zip\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.preview && singleSelection().isImage() && singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="openImagePreview()">\r\n                <i class="glyphicon glyphicon-picture"></i> {{\'view_item\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.rename && singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="modal(\'rename\')">\r\n                <i class="glyphicon glyphicon-edit"></i> {{\'rename\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.move">\r\n            <a href="" tabindex="-1" ng-click="modalWithPathSelector(\'move\')">\r\n                <i class="glyphicon glyphicon-arrow-right"></i> {{\'move\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.copy && !selectionHas(\'dir\')">\r\n            <a href="" tabindex="-1" ng-click="modalWithPathSelector(\'copy\')">\r\n                <i class="glyphicon glyphicon-log-out"></i> {{\'copy\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.edit && singleSelection() && singleSelection().isEditable()">\r\n            <a href="" tabindex="-1" ng-click="openEditItem()">\r\n                <i class="glyphicon glyphicon-pencil"></i> {{\'edit\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.changePermissions">\r\n            <a href="" tabindex="-1" ng-click="modal(\'changepermissions\')">\r\n                <i class="glyphicon glyphicon-lock"></i> {{\'permissions\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.compress && (!singleSelection() || selectionHas(\'dir\'))">\r\n            <a href="" tabindex="-1" ng-click="modal(\'compress\')">\r\n                <i class="glyphicon glyphicon-compressed"></i> {{\'compress\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.extract && singleSelection() && singleSelection().isExtractable()">\r\n            <a href="" tabindex="-1" ng-click="modal(\'extract\')">\r\n                <i class="glyphicon glyphicon-export"></i> {{\'extract\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li class="divider" ng-show="config.allowedActions.remove"></li>\r\n        \r\n        <li ng-show="config.allowedActions.remove">\r\n            <a href="" tabindex="-1" ng-click="modal(\'remove\')">\r\n                <i class="glyphicon glyphicon-trash"></i> {{\'remove\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n    </ul>\r\n\r\n    <ul class="dropdown-menu dropdown-right-click" role="menu" aria-labelledby="dropdownMenu" ng-show="!temps.length">\r\n        <li ng-show="config.allowedActions.createFolder">\r\n            <a href="" tabindex="-1" ng-click="modal(\'newfolder\') && prepareNewFolder()">\r\n                <i class="glyphicon glyphicon-plus"></i> {{\'new_folder\' | translate}}\r\n            </a>\r\n        </li>\r\n        <li ng-show="config.allowedActions.upload">\r\n            <a href="" tabindex="-1" ng-click="modal(\'uploadfile\')">\r\n                <i class="glyphicon glyphicon-cloud-upload"></i> {{\'upload_files\' | translate}}\r\n            </a>\r\n        </li>\r\n    </ul>\r\n</div>');
$templateCache.put('src/templates/main-icons.html','<div class="iconset noselect">\r\n    <div class="item-list clearfix" ng-click="selectOrUnselect(null, $event)" ng-right-click="selectOrUnselect(null, $event)" prevent="true">\r\n        <div class="col-120" ng-repeat="item in $parent.fileList = (fileNavigator.fileList | filter: {model:{name: query}})" ng-show="!fileNavigator.requesting && !fileNavigator.error">\r\n            <a href="" class="thumbnail text-center" ng-click="selectOrUnselect(item, $event)" ng-dblclick="smartClick(item)" ng-right-click="selectOrUnselect(item, $event)" title="{{item.model.name}} ({{item.model.size | humanReadableFileSize}})" ng-class="{selected: isSelected(item)}">\r\n                <div class="item-icon">\r\n                    <i class="glyphicon glyphicon-folder-open" ng-show="item.model.type === \'dir\'"></i>\r\n                    <i class="glyphicon glyphicon-file" data-ext="{{ item.model.name | fileExtension }}" ng-show="item.model.type === \'file\'" ng-class="{\'item-extension\': config.showExtensionIcons}"></i>\r\n                </div>\r\n                {{item.model.name | strLimit : 11 }}\r\n            </a>\r\n        </div>\r\n    </div>\r\n\r\n    <div ng-show="fileNavigator.requesting">\r\n        <div ng-include="config.tplPath + \'/spinner.html\'"></div>\r\n    </div>\r\n\r\n    <div class="alert alert-warning" ng-show="!fileNavigator.requesting && fileNavigator.fileList.length < 1 && !fileNavigator.error">\r\n        {{"no_files_in_folder" | translate}}...\r\n    </div>\r\n    \r\n    <div class="alert alert-danger" ng-show="!fileNavigator.requesting && fileNavigator.error">\r\n        {{ fileNavigator.error }}\r\n    </div>\r\n</div>');
$templateCache.put('src/templates/main-table-modal.html','<table class="table table-condensed table-modal-condensed mb0">\r\n    <thead>\r\n        <tr>\r\n            <th>\r\n                <a href="" ng-click="order(\'model.name\')">\r\n                    {{"name" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.name\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="text-right"></th>\r\n        </tr>\r\n    </thead>\r\n    <tbody class="file-item">\r\n        <tr ng-show="fileNavigator.requesting">\r\n            <td colspan="2">\r\n                <div ng-include="config.tplPath + \'/spinner.html\'"></div>\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting && !fileNavigator.listHasFolders() && !fileNavigator.error">\r\n            <td>\r\n                {{"no_folders_in_folder" | translate}}...\r\n            </td>\r\n            <td class="text-right">\r\n                <button class="btn btn-sm btn-default" ng-click="fileNavigator.upDir()">{{"go_back" | translate}}</button>\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting && fileNavigator.error">\r\n            <td colspan="2">\r\n                {{ fileNavigator.error }}\r\n            </td>\r\n        </tr>\r\n        <tr ng-repeat="item in fileNavigator.fileList | orderBy:predicate:reverse" ng-show="!fileNavigator.requesting && item.model.type === \'dir\'" ng-if="!selectedFilesAreChildOfPath(item)">\r\n            <td>\r\n                <a href="" ng-click="fileNavigator.folderClick(item)" title="{{item.model.name}} ({{item.model.size | humanReadableFileSize}})">\r\n                    <i class="glyphicon glyphicon-folder-close"></i>\r\n                    {{item.model.name | strLimit : 32}}\r\n                </a>\r\n            </td>\r\n            <td class="text-right">\r\n                <button class="btn btn-sm btn-default" ng-click="select(item)">\r\n                    <i class="glyphicon glyphicon-hand-up"></i> {{"select_this" | translate}}\r\n                </button>\r\n            </td>\r\n        </tr>\r\n    </tbody>\r\n</table>');
$templateCache.put('src/templates/main-table.html','<table class="table mb0 table-files noselect">\r\n    <thead>\r\n        <tr>\r\n            <th>\r\n                <a href="" ng-click="order(\'model.name\')">\r\n                    {{"name" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.name\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="hidden-xs" ng-hide="config.hideSize">\r\n                <a href="" ng-click="order(\'model.size\')">\r\n                    {{"size" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.size\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="hidden-sm hidden-xs" ng-hide="config.hideDate">\r\n                <a href="" ng-click="order(\'model.date\')">\r\n                    {{"date" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.date\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="hidden-sm hidden-xs" ng-hide="config.hidePermissions">\r\n                <a href="" ng-click="order(\'model.permissions\')">\r\n                    {{"permissions" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.permissions\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n        </tr>\r\n    </thead>\r\n    <tbody class="file-item">\r\n        <tr ng-show="fileNavigator.requesting">\r\n            <td colspan="5">\r\n                <div ng-include="config.tplPath + \'/spinner.html\'"></div>\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting &amp;&amp; fileNavigator.fileList.length < 1 &amp;&amp; !fileNavigator.error">\r\n            <td colspan="5">\r\n                {{"no_files_in_folder" | translate}}...\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting &amp;&amp; fileNavigator.error">\r\n            <td colspan="5">\r\n                {{ fileNavigator.error }}\r\n            </td>\r\n        </tr>\r\n        <tr class="item-list" ng-repeat="item in $parent.fileList = (fileNavigator.fileList | filter: {model:{name: query}} | orderBy:predicate:reverse)" ng-show="!fileNavigator.requesting" ng-click="selectOrUnselect(item, $event)" ng-dblclick="smartClick(item)" ng-right-click="selectOrUnselect(item, $event)" ng-class="{selected: isSelected(item)}">\r\n            <td>\r\n                <a href="" title="{{item.model.name}} ({{item.model.size | humanReadableFileSize}})">\r\n                    <i class="glyphicon glyphicon-folder-close" ng-show="item.model.type === \'dir\'"></i>\r\n                    <i class="glyphicon glyphicon-file" ng-show="item.model.type === \'file\'"></i>\r\n                    {{item.model.name | strLimit : 64}}\r\n                </a>\r\n            </td>\r\n            <td class="hidden-xs">\r\n                <span ng-show="item.model.type !== \'dir\' || config.showSizeForDirectories">\r\n                    {{item.model.size | humanReadableFileSize}}\r\n                </span>\r\n            </td>\r\n            <td class="hidden-sm hidden-xs" ng-hide="config.hideDate">\r\n                {{item.model.date | formatDate }}\r\n            </td>\r\n            <td class="hidden-sm hidden-xs" ng-hide="config.hidePermissions">\r\n                {{item.model.perms.toCode(item.model.type === \'dir\'?\'d\':\'-\')}}\r\n            </td>\r\n        </tr>\r\n    </tbody>\r\n</table>\r\n');
$templateCache.put('src/templates/main.html','<div ng-controller="FileManagerCtrl">\r\n    <div ng-include="config.tplPath + \'/navbar.html\'"></div>\r\n\r\n    <div class="container-fluid">\r\n        <div class="row">\r\n\r\n            <div class="col-sm-4 col-md-3 sidebar file-tree animated slow fadeIn" ng-include="config.tplPath + \'/sidebar.html\'" ng-show="config.sidebar &amp;&amp; fileNavigator.history[0]">\r\n            </div>\r\n\r\n            <div class="main" ng-class="config.sidebar &amp;&amp; fileNavigator.history[0] &amp;&amp; \'col-sm-8 col-md-9\'" ngf-model-options="{updateOn: \'drop\', allowInvalid: false, debounce: 0}" ngf-drop="addForUpload($files)" ngf-drag-over-class="\'upload-dragover\'" ngf-multiple="true">\r\n                <div ng-include="config.tplPath + \'/\' + viewTemplate" class="main-navigation clearfix"></div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div ng-include="config.tplPath + \'/modals.html\'"></div>\r\n    <div ng-include="config.tplPath + \'/item-context-menu.html\'"></div>\r\n</div>\r\n');
$templateCache.put('src/templates/modals.html','<div class="modal animated fadeIn" id="imagepreview">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n      <div class="modal-header">\r\n        <button type="button" class="close" data-dismiss="modal">\r\n            <span aria-hidden="true">&times;</span>\r\n            <span class="sr-only">{{"close" | translate}}</span>\r\n        </button>\r\n        <h4 class="modal-title">{{"preview" | translate}}</h4>\r\n      </div>\r\n      <div class="modal-body">\r\n        <div class="text-center">\r\n          <img id="imagepreview-target" class="preview" alt="{{singleSelection().model.name}}" ng-class="{\'loading\': apiMiddleware.apiHandler.inprocess}">\r\n          <span class="label label-warning" ng-show="apiMiddleware.apiHandler.inprocess">{{\'loading\' | translate}} ...</span>\r\n        </div>\r\n        <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n      </div>\r\n      <div class="modal-footer">\r\n        <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="remove">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n    <form ng-submit="remove()">\r\n      <div class="modal-header">\r\n        <button type="button" class="close" data-dismiss="modal">\r\n            <span aria-hidden="true">&times;</span>\r\n            <span class="sr-only">{{"close" | translate}}</span>\r\n        </button>\r\n        <h4 class="modal-title">{{"confirm" | translate}}</h4>\r\n      </div>\r\n      <div class="modal-body">\r\n        {{\'sure_to_delete\' | translate}} <span ng-include data-src="\'selected-files-msg\'"></span>\r\n\r\n        <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n      </div>\r\n      <div class="modal-footer">\r\n        <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n        <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess" autofocus="autofocus">{{"remove" | translate}}</button>\r\n      </div>\r\n      </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="move">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="move()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'move\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-include data-src="\'path-selector\'" class="clearfix"></div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'move\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n\r\n<div class="modal animated fadeIn" id="rename">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="rename()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'rename\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <label class="radio">{{\'enter_new_name_for\' | translate}} <b>{{singleSelection() && singleSelection().model.name}}</b></label>\r\n              <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'rename\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="copy">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="copy()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'copy_file\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-show="singleSelection()">\r\n                <label class="radio">{{\'enter_new_name_for\' | translate}} <b>{{singleSelection().model.name}}</b></label>\r\n                <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n              </div>\r\n\r\n              <div ng-include data-src="\'path-selector\'" class="clearfix"></div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"copy" | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="compress">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="compress()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'compress\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <div class="label label-success error-msg">{{\'compression_started\' | translate}}</div>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <div ng-hide="config.allowedActions.compressChooseName">\r\n                    {{\'sure_to_start_compression_with\' | translate}} <b>{{singleSelection().model.name}}</b> ?\r\n                  </div>\r\n                  <div ng-show="config.allowedActions.compressChooseName">\r\n                    <label class="radio">\r\n                      {{\'enter_file_name_for_compression\' | translate}}\r\n                      <span ng-include data-src="\'selected-files-msg\'"></span>\r\n                    </label>\r\n                    <input class="form-control" ng-model="temp.tempModel.name" autofocus="autofocus">\r\n                  </div>\r\n              </div>\r\n\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n                  <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'compress\' | translate}}</button>\r\n              </div>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="extract" ng-init="singleSelection().emptyName()">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="extract()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'extract_item\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <div class="label label-success error-msg">{{\'extraction_started\' | translate}}</div>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <label class="radio">{{\'enter_folder_name_for_extraction\' | translate}} <b>{{singleSelection().model.name}}</b></label>\r\n                  <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n              </div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n                  <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'extract\' | translate}}</button>\r\n              </div>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="edit" ng-class="{\'modal-fullscreen\': fullscreen}">\r\n  <div class="modal-dialog modal-lg">\r\n    <div class="modal-content">\r\n        <form ng-submit="edit()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <button type="button" class="close fullscreen" ng-click="fullscreen=!fullscreen">\r\n                  <i class="glyphicon glyphicon-fullscreen"></i>\r\n                  <span class="sr-only">{{\'toggle_fullscreen\' | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'edit_file\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n                <label class="radio bold">{{ singleSelection().model.fullPath() }}</label>\r\n                <span class="label label-warning" ng-show="apiMiddleware.apiHandler.inprocess">{{\'loading\' | translate}} ...</span>\r\n                <textarea class="form-control code" ng-model="singleSelection().tempModel.content" ng-show="!apiMiddleware.apiHandler.inprocess" autofocus="autofocus"></textarea>\r\n                <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'close\' | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-show="config.allowedActions.edit" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'save\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="newfolder">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="createFolder()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'new_folder\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <label class="radio">{{\'folder_name\' | translate}}</label>\r\n              <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'create\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="uploadfile">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form>\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{"upload_files" | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <label class="radio">\r\n                {{"files_will_uploaded_to" | translate}} \r\n                <b>/{{fileNavigator.currentPath.join(\'/\')}}</b>\r\n              </label>\r\n              <button class="btn btn-default btn-block" ngf-select="$parent.addForUpload($files)" ngf-multiple="true">\r\n                {{"select_files" | translate}}\r\n              </button>\r\n              \r\n              <div class="upload-list">\r\n                <ul class="list-group">\r\n                  <li class="list-group-item" ng-repeat="(index, uploadFile) in $parent.uploadFileList">\r\n                    <button class="btn btn-sm btn-danger pull-right" ng-click="$parent.removeFromUpload(index)">\r\n                        &times;\r\n                    </button>\r\n                    <h5 class="list-group-item-heading">{{uploadFile.name}}</h5>\r\n                    <p class="list-group-item-text">{{uploadFile.size | humanReadableFileSize}}</p>\r\n                  </li>\r\n                </ul>\r\n                <div ng-show="apiMiddleware.apiHandler.inprocess">\r\n                  <em>{{"uploading" | translate}}... {{apiMiddleware.apiHandler.progress}}%</em>\r\n                  <div class="progress mb0">\r\n                    <div class="progress-bar active" role="progressbar" aria-valuenow="{{apiMiddleware.apiHandler.progress}}" aria-valuemin="0" aria-valuemax="100" style="width: {{apiMiddleware.apiHandler.progress}}%"></div>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <div>\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal">{{"cancel" | translate}}</button>\r\n                  <button type="submit" class="btn btn-primary" ng-disabled="!$parent.uploadFileList.length || apiMiddleware.apiHandler.inprocess" ng-click="uploadFiles()">{{\'upload\' | translate}}</button>\r\n              </div>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="changepermissions">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="changePermissions()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'change_permissions\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <table class="table mb0">\r\n                  <thead>\r\n                      <tr>\r\n                          <th>{{\'permissions\' | translate}}</th>\r\n                          <th class="col-xs-1 text-center">{{\'read\' | translate}}</th>\r\n                          <th class="col-xs-1 text-center">{{\'write\' | translate}}</th>\r\n                          <th class="col-xs-1 text-center">{{\'exec\' | translate}}</th>\r\n                      </tr>\r\n                  </thead>\r\n                  <tbody>\r\n                      <tr ng-repeat="(permTypeKey, permTypeValue) in temp.tempModel.perms">\r\n                          <td>{{permTypeKey | translate}}</td>\r\n                          <td ng-repeat="(permKey, permValue) in permTypeValue" class="col-xs-1 text-center" ng-click="main()">\r\n                              <label class="col-xs-12">\r\n                                <input type="checkbox" ng-model="temp.tempModel.perms[permTypeKey][permKey]">\r\n                              </label>\r\n                          </td>\r\n                      </tr>\r\n                </tbody>\r\n              </table>\r\n              <div class="checkbox" ng-show="config.enablePermissionsRecursive && selectionHas(\'dir\')">\r\n                <label>\r\n                  <input type="checkbox" ng-model="temp.tempModel.recursive"> {{\'recursive\' | translate}}\r\n                </label>\r\n              </div>\r\n              <div class="clearfix mt10">\r\n                  <span class="label label-primary pull-left" ng-hide="temp.multiple">\r\n                    {{\'original\' | translate}}: \r\n                    {{temp.model.perms.toCode(selectionHas(\'dir\') ? \'d\':\'-\')}} \r\n                    ({{temp.model.perms.toOctal()}})\r\n                  </span>\r\n                  <span class="label label-primary pull-right">\r\n                    {{\'changes\' | translate}}: \r\n                    {{temp.tempModel.perms.toCode(selectionHas(\'dir\') ? \'d\':\'-\')}} \r\n                    ({{temp.tempModel.perms.toOctal()}})\r\n                  </span>\r\n              </div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="">{{\'change\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="selector" ng-controller="ModalFileManagerCtrl">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n      <div class="modal-header">\r\n        <button type="button" class="close" data-dismiss="modal">\r\n            <span aria-hidden="true">&times;</span>\r\n            <span class="sr-only">{{"close" | translate}}</span>\r\n        </button>\r\n        <h4 class="modal-title">{{"select_destination_folder" | translate}}</h4>\r\n      </div>\r\n      <div class="modal-body">\r\n        <div>\r\n            <div ng-include="config.tplPath + \'/current-folder-breadcrumb.html\'"></div>\r\n            <div ng-include="config.tplPath + \'/main-table-modal.html\'"></div>\r\n            <hr />\r\n            <button class="btn btn-sm btn-default" ng-click="selectCurrent()">\r\n                <i class="glyphicon"></i> {{"select_this" | translate}}\r\n            </button>\r\n        </div>\r\n      </div>\r\n      <div class="modal-footer">\r\n        <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<script type="text/ng-template" id="path-selector">\r\n  <div class="panel panel-primary mt10 mb0">\r\n    <div class="panel-body">\r\n        <div class="detail-sources">\r\n          <div class="like-code mr5"><b>{{"selection" | translate}}:</b>\r\n            <span ng-include="\'selected-files-msg\'"></span>\r\n          </div>\r\n        </div>\r\n        <div class="detail-sources">\r\n          <div class="like-code mr5">\r\n            <b>{{"destination" | translate}}:</b> {{ getSelectedPath() }}\r\n          </div>\r\n          <a href="" class="label label-primary" ng-click="openNavigator(fileNavigator.currentPath)">\r\n            {{\'change\' | translate}}\r\n          </a>\r\n        </div>\r\n    </div>\r\n  </div>\r\n</script>\r\n\r\n<script type="text/ng-template" id="error-bar">\r\n  <div class="label label-danger error-msg pull-left animated fadeIn" ng-show="apiMiddleware.apiHandler.error">\r\n    <i class="glyphicon glyphicon-remove-circle"></i>\r\n    <span>{{apiMiddleware.apiHandler.error}}</span>\r\n  </div>\r\n</script>\r\n\r\n<script type="text/ng-template" id="selected-files-msg">\r\n  <span ng-show="temps.length == 1">\r\n    {{singleSelection().model.name}}\r\n  </span>\r\n  <span ng-show="temps.length > 1">\r\n    {{\'these_elements\' | translate:totalSelecteds()}}\r\n    <a href="" class="label label-primary" ng-click="showDetails = !showDetails">\r\n      {{showDetails ? \'-\' : \'+\'}} {{\'details\' | translate}}\r\n    </a>\r\n  </span>\r\n  <div ng-show="temps.length > 1 &amp;&amp; showDetails">\r\n    <ul class="selected-file-details">\r\n      <li ng-repeat="tempItem in temps">\r\n        <b>{{tempItem.model.name}}</b>\r\n      </li>\r\n    </ul>\r\n  </div>\r\n</script>\r\n');
$templateCache.put('src/templates/navbar.html','<nav class="navbar navbar-inverse">\r\n    <div class="container-fluid">\r\n        <div class="row">\r\n            <div class="col-sm-9 col-md-10 hidden-xs">\r\n                <div ng-show="!config.breadcrumb">\r\n                    <a class="navbar-brand hidden-xs ng-binding" href="">angular-{{"filemanager" | translate}}</a>\r\n                </div>\r\n                <div ng-include="config.tplPath + \'/current-folder-breadcrumb.html\'" ng-show="config.breadcrumb">\r\n                </div>\r\n            </div>\r\n            <div class="col-sm-3 col-md-2">\r\n                <div class="navbar-collapse">\r\n                    <div class="navbar-form navbar-right text-right">\r\n                        <div class="pull-left visible-xs" ng-if="fileNavigator.currentPath.length">\r\n                            <button class="btn btn-primary btn-flat" ng-click="fileNavigator.upDir()">\r\n                                <i class="glyphicon glyphicon-chevron-left"></i>\r\n                            </button>\r\n                            {{fileNavigator.getCurrentFolderName() | strLimit : 12}}\r\n                        </div>\r\n                        <div class="btn-group">\r\n                            <button class="btn btn-flat btn-sm dropdown-toggle" type="button" id="dropDownMenuSearch" data-toggle="dropdown" aria-expanded="true">\r\n                                <i class="glyphicon glyphicon-search mr2"></i>\r\n                            </button>\r\n                            <div class="dropdown-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="dropDownMenuLang">\r\n                                <input type="text" class="form-control" ng-show="config.searchForm" placeholder="{{\'search\' | translate}}..." ng-model="$parent.query">\r\n                            </div>\r\n                        </div>\r\n\r\n                        <button class="btn btn-flat btn-sm" ng-click="$parent.setTemplate(\'main-icons.html\')" ng-show="$parent.viewTemplate !==\'main-icons.html\'" title="{{\'icons\' | translate}}">\r\n                            <i class="glyphicon glyphicon-th-large"></i>\r\n                        </button>\r\n\r\n                        <button class="btn btn-flat btn-sm" ng-click="$parent.setTemplate(\'main-table.html\')" ng-show="$parent.viewTemplate !==\'main-table.html\'" title="{{\'list\' | translate}}">\r\n                            <i class="glyphicon glyphicon-th-list"></i>\r\n                        </button>\r\n\r\n                        <div class="btn-group">\r\n                            <button class="btn btn-flat btn-sm dropdown-toggle" type="button" id="dropDownMenuLang" data-toggle="dropdown" aria-expanded="true" ng-show="config.multiLang">\r\n                                <i class="glyphicon glyphicon-globe mr2"></i>\r\n                            </button>\r\n\r\n                            <ul class="dropdown-menu scrollable-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="dropDownMenuLang">\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'en\')">English</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'zh_tw\')">\u6B63\u9AD4\u4E2D\u6587</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'zh_cn\')">\u7B80\u4F53\u4E2D\u6587</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'es\')">Espa\xF1ol</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'nl\')">Nederlands</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'pt\')">Portugues</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'fr\')">Fran\xE7ais</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'de\')">Deutsch</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'he\')">\u05E2\u05D1\u05E8\u05D9</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'it\')">italiano</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'sk\')">Sloven\u010Dina</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'ru\')">\u0440\u0443\u0441\u0441\u043A\u0438\u0439</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'ua\')">\u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0438\u0439</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'tr\')">T\xFCrk\xE7e</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'fa\')">\u0641\u0627\u0631\u0633\u06CC</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'pl\')">Polski</a></li>\r\n                            </ul>\r\n                        </div>\r\n\r\n                        <div class="btn-group">\r\n                            <button class="btn btn-flat btn-sm dropdown-toggle" type="button" id="more" data-toggle="dropdown" aria-expanded="true">\r\n                                <i class="glyphicon glyphicon-option-vertical"></i>\r\n                            </button>\r\n\r\n                            <ul class="dropdown-menu scrollable-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="more">\r\n                                <li role="presentation" ng-show="config.allowedActions.createFolder" ng-click="modal(\'newfolder\') && prepareNewFolder()">\r\n                                    <a href="" role="menuitem" tabindex="-1">\r\n                                        <i class="glyphicon glyphicon-plus"></i> {{"new_folder" | translate}}\r\n                                    </a>\r\n                                </li>\r\n                                <li role="presentation" ng-show="config.allowedActions.upload" ng-click="modal(\'uploadfile\')">\r\n                                    <a href="" role="menuitem" tabindex="-1">\r\n                                        <i class="glyphicon glyphicon-cloud-upload"></i> {{"upload_files" | translate}}\r\n                                    </a>\r\n                                </li>\r\n                            </ul>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</nav>\r\n');
$templateCache.put('src/templates/sidebar.html','<ul class="nav nav-sidebar file-tree-root">\r\n    <li ng-repeat="item in fileNavigator.history" ng-include="\'folder-branch-item\'" ng-class="{\'active\': item.name == fileNavigator.currentPath.join(\'/\')}"></li>\r\n</ul>\r\n\r\n<script type="text/ng-template" id="folder-branch-item">\r\n    <a href="" ng-click="fileNavigator.folderClick(item.item)" class="animated fast fadeInDown">\r\n\r\n        <span class="point">\r\n            <i class="glyphicon glyphicon-chevron-down" ng-show="isInThisPath(item.name)"></i>\r\n            <i class="glyphicon glyphicon-chevron-right" ng-show="!isInThisPath(item.name)"></i>\r\n        </span>\r\n\r\n        <i class="glyphicon glyphicon-folder-open mr2" ng-show="isInThisPath(item.name)"></i>\r\n        <i class="glyphicon glyphicon-folder-close mr2" ng-show="!isInThisPath(item.name)"></i>\r\n        {{ (item.name.split(\'/\').pop() || fileNavigator.getBasePath().join(\'/\') || \'/\') | strLimit : 30 }}\r\n    </a>\r\n    <ul class="nav nav-sidebar">\r\n        <li ng-repeat="item in item.nodes" ng-include="\'folder-branch-item\'" ng-class="{\'active\': item.name == fileNavigator.currentPath.join(\'/\')}"></li>\r\n    </ul>\r\n</script>');
$templateCache.put('src/templates/spinner.html','<div class="spinner-wrapper col-xs-12">\r\n    <svg class="spinner-container" style="width:65px;height:65px" viewBox="0 0 44 44">\r\n        <circle class="path" cx="22" cy="22" r="20" fill="none" stroke-width="4"></circle>\r\n    </svg>\r\n</div>');}]);