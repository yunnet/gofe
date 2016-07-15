package fe

import (
	"github.com/md2k/gofe/models"
)

type FileExplorer interface {
	Init() error
	ListDir(path string) ([]models.ListDirEntry, error)
	Move(path string, newPath string) error
	Copy(path string, newPath string) error
	Delete(path string) error
	Chmod(path string, code string) error
	Mkdir(path string, name string) error
	Close() error
}
