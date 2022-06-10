## gofe - Go File Explorer
A golang backend for angular-explorer - https://github.com/yunnet/angular-explorer

### Todo
##### [API](https://github.com/joni2back/angular-filemanager/blob/master/API.md)
- [x] [Listing](https://github.com/joni2back/angular-filemanager/blob/master/API.md#listing-url-filemanagerconfiglisturl-method-post) 
- [x] [Rename](https://github.com/joni2back/angular-filemanager/blob/master/API.md#rename-url-filemanagerconfigrenameurl-method-post)
- [x] [Move](https://github.com/joni2back/angular-filemanager/blob/master/API.md#move-url-filemanagerconfigmoveurl-method-post)
- [x] [Copy](https://github.com/joni2back/angular-filemanager/blob/master/API.md#copy-url-filemanagerconfigcopyurl-method-post)
- [x] [Remove/Delete](https://github.com/joni2back/angular-filemanager/blob/master/API.md#remove-url-filemanagerconfigremoveurl-method-post)
- [ ] [Edit](https://github.com/joni2back/angular-filemanager/blob/master/API.md#edit-file-url-filemanagerconfigediturl-method-post)
- [ ] [getContent](https://github.com/joni2back/angular-filemanager/blob/master/API.md#get-content-of-a-file-url-filemanagerconfiggetcontenturl-method-post)
- [x] [createFolder](https://github.com/joni2back/angular-filemanager/blob/master/API.md#create-folder-url-filemanagerconfigcreatefolderurl-method-post)
- [x] [changePermissions](https://github.com/joni2back/angular-filemanager/blob/master/API.md#set-permissions-url-filemanagerconfigpermissionsurl-method-post)
- [ ] [compress](https://github.com/joni2back/angular-filemanager/blob/master/API.md#compress-file-url-filemanagerconfigcompressurl-method-post)
- [ ] [extract](https://github.com/joni2back/angular-filemanager/blob/master/API.md#extract-file-url-filemanagerconfigextracturl-method-post)
- [x] [Upload](https://github.com/joni2back/angular-filemanager/blob/master/API.md#upload-file-url-filemanagerconfiguploadurl-method-post-content-type-multipartform-data)
- [x] [Download](https://github.com/joni2back/angular-filemanager/blob/master/API.md#download--preview-file-url-filemanagerconfigdownloadmultipleurl-method-get)
- [ ] [Download Many as Zip](https://github.com/joni2back/angular-filemanager/blob/master/API.md#download-multiples-files-in-ziptar-url-filemanagerconfigdownloadfileurl-method-get)


### Screenshots
![](https://raw.githubusercontent.com/kernel164/gofe/master/screenshot1.png)
![](https://raw.githubusercontent.com/kernel164/gofe/master/screenshot2.png)

### Features
- Login support
- SSH backend support

### Sample Config
```ini
SERVER = http

[server.http]
BIND = localhost:4000
STATICS = angular-filemanager/bower_components,angular-filemanager/dist,angular-filemanager/src

```
