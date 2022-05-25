package models

type GenericReq struct {
	Action           string   `json:"action" binding:"Required"`
	OnlyFoldreferers bool     `json:"onlyFolders"`    // list
	Path             string   `json:"path"`           // ALL
	Items            []string `json:"items"`          // API v1.5+ List of Items for Copy/Move/Remove/changePermissions/compress/downloadMultiple
	Item             string   `json:"item"`           // API v1.5+ Rename
	NewPath          string   `json:"newPath"`        // move/rename, copy
	NewItemPath      string   `json:"newItemPath"`    // API v1.5+ Reanme Action
	Content          string   `json:"content"`        // edit
	SingleFilename   string   `json:"singleFilename"` // API v1.5+ Copy
	Perms            string   `json:"perms"`          // changepermissions
	PermsCode        string   `json:"permsCode"`      // changepermissions
	Recursive        bool     `json:"recursive"`      // changepermissions
	Destination      string   `json:"destination"`    // compress, extract
	SourceFile       string   `json:"sourceFile"`     // extract
	Preview          bool     `json:"preview"`        // download
}

type Item struct {
	string
}

type ListDirResp struct {
	Result []ListDirEntry `json:"result" binding:"Required"`
}

type ListDirEntry struct {
	Name   string `json:"name" binding:"Required"`
	Rights string `json:"rights" binding:"Required"`
	Size   string `json:"size" binding:"Required"`
	Date   string `json:"date" binding:"Required"`
	Type   string `json:"type" binding:"Required"`
}

type GenericResp struct {
	Result GenericRespBody `json:"result" binding:"Required"`
}

type GenericRespBody struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type GetContentResp struct {
	Result string `json:"result" binding:"Required"`
}
