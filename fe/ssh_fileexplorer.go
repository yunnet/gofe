// TODO:  Better handling of errors from SSH Back-end executions.
// ExecOnly() / Exec()
// 'Process exited with status 1' Not very informative :)

package fe

import (
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"github.com/md2k/gofe/models"
	"golang.org/x/crypto/ssh"
)

const DefaultTimeout = 30 * time.Second

type SSHFileExplorer struct {
	FileExplorer
	Host     string
	User     string
	Password string
	client   *ssh.Client
}

func NewSSHFileExplorer(host string, user string, password string) *SSHFileExplorer {
	return &SSHFileExplorer{Host: host, User: user, Password: password}
}

func (fe *SSHFileExplorer) Init() error {
	sshConfig := &ssh.ClientConfig{
		User: fe.User,
		Auth: []ssh.AuthMethod{
			ssh.Password(fe.Password),
		},
	}

	conn, err := net.DialTimeout("tcp", fe.Host, DefaultTimeout)
	if err != nil {
		return err
	}
	sshConn, chans, reqs, err := ssh.NewClientConn(conn, fe.Host, sshConfig)
	if err != nil {
		return err
	}
	client := ssh.NewClient(sshConn, chans, reqs)

	fe.client = client

	return nil
}

func normalizePath(path string) string {
	if !strings.HasPrefix(path, "/") {
		return "/" + path
	}
	return path
}

func (fe *SSHFileExplorer) Mkdir(path string) error {
	return fe.ExecOnly(fmt.Sprintf("mkdir -p %s", normalizePath(path)))
}

func (fe *SSHFileExplorer) ListDir(path string) ([]models.ListDirEntry, error) {
	ls, err := fe.Exec(fmt.Sprintf("ls --time-style=long-iso -l %s", normalizePath(path)))
	if err != nil {
		return nil, err
	}
	return parseLsOutput(string(ls)), nil
}

func (fe *SSHFileExplorer) Rename(path string, newPath string) error {
	return fe.ExecOnly(fmt.Sprintf("mv %s %s", normalizePath(path), normalizePath(newPath)))
}

func (fe *SSHFileExplorer) Move(path []string, newPath string) (err error) {
	for _, target := range path {
		err = fe.ExecOnly(fmt.Sprintf("mv %s %s", normalizePath(target), normalizePath(newPath)))
	}
	return err
}

func (fe *SSHFileExplorer) Copy(path []string, newPath string, singleFilename string) (err error) {
	for _, target := range path {
		err = fe.ExecOnly(fmt.Sprintf("cp -r %s %s/%s", normalizePath(target), normalizePath(newPath), singleFilename))
	}
	return err
}

func (fe *SSHFileExplorer) Delete(path []string) (err error) {
	for _, target := range path {
		err = fe.ExecOnly(fmt.Sprintf("rm --interactive=never -r %S", normalizePath(target)))
	}
	return err
}

func (fe *SSHFileExplorer) Chmod(path []string, code string, recursive bool) (err error) {
	for _, target := range path {
		recurs := ""
		if recursive {
			recurs = "-R"
		}
		err = fe.ExecOnly(fmt.Sprintf("chmod %s %s %s", recurs, code, normalizePath(target)))
	}
	return err
}

func (fe *SSHFileExplorer) Close() error {
	return fe.client.Close()
}

// Execute cmd on the remote host and return stderr and stdout
func (fe *SSHFileExplorer) Exec(cmd string) ([]byte, error) {
	log.Println(cmd)
	session, err := fe.client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()
	return session.CombinedOutput(cmd)
}

func (fe *SSHFileExplorer) ExecOnly(cmd string) error {
	log.Println(cmd)
	session, err := fe.client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()
	_, err1 := session.CombinedOutput(cmd)
	if err1 != nil {
		return err1 // + " - " + string(out)
	}
	return nil
}

func parseLsOutput(lsout string) []models.ListDirEntry {
	lines := strings.Split(lsout, "\n")
	results := []models.ListDirEntry{}
	for _, line := range lines {
		//fmt.Println(idx, line)
		if len(line) != 0 && !strings.HasPrefix(line, "total") {
			tokens := strings.Fields(line)
			if len(tokens) >= 8 {
				ftype := "file"
				if strings.HasPrefix(tokens[0], "d") {
					ftype = "dir"
				}
				results = append(results, models.ListDirEntry{tokens[7], tokens[0], tokens[4], tokens[5] + " " + tokens[6] + ":00", ftype})
			}
		}
	}
	return results
}
