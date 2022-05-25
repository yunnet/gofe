// TODO:  Better handling of errors from SSH Back-end executions.
// ExecOnly() / Exec()
// 'Process exited with status 1' Not very informative :)

package fe

import (
	"fmt"
	"gofe/models"
	"io"
	"io/ioutil"
	"log"
	"mime/multipart"
	"net"
	"strings"
	"time"

	"github.com/pkg/sftp"
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

func (c *SSHFileExplorer) Init() error {
	sshConfig := &ssh.ClientConfig{
		User: c.User,
		Auth: []ssh.AuthMethod{
			ssh.Password(c.Password),
		},
		Timeout: 30 * time.Second,
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			return nil
		},
	}

	conn, err := net.DialTimeout("tcp", c.Host, DefaultTimeout)
	if err != nil {
		return err
	}
	sshConn, chans, reqs, err := ssh.NewClientConn(conn, c.Host, sshConfig)
	if err != nil {
		return err
	}
	client := ssh.NewClient(sshConn, chans, reqs)

	c.client = client

	return nil
}

func normalizePath(path string) string {
	if !strings.HasPrefix(path, "/") {
		return "/" + path
	}
	return path
}

func (c *SSHFileExplorer) Mkdir(path string) error {
	return c.ExecOnly(fmt.Sprintf("mkdir -p \"%s\"", normalizePath(path)))
}

func (c *SSHFileExplorer) ListDir(path string) ([]models.ListDirEntry, error) {
	// Most ugliest Fix, but nothing other can be done here to able parse LS in correct way and support files with spaces in names :)
	// Have another idea, but this is for later TODO
	ls, err := c.Exec("ls --time-style=long-iso -1 -q -l --hide-control-chars " + normalizePath(path) + " | awk '{n=split($0,array,\" \")} { for (i = 1; i <= 7; i++) {printf \"%s|\",array[i]}} { for (i = 8; i <= n; i++) {printf \"%s \",array[i]};print \"\"}'")
	// ls, err := c.Exec(fmt.Sprintf("ls --time-style=long-iso -l %s", normalizePath(path)))
	if err != nil {
		return nil, err
	}
	return parseLsOutput(string(ls)), nil
}

func (c *SSHFileExplorer) Rename(path string, newPath string) error {
	return c.ExecOnly(fmt.Sprintf("mv \"%s\" \"%s\"", normalizePath(path), normalizePath(newPath)))
}

func (c *SSHFileExplorer) Move(path []string, newPath string) (err error) {
	for _, target := range path {
		err = c.ExecOnly(fmt.Sprintf("mv \"%s\" \"%s\"", normalizePath(target), normalizePath(newPath)))
	}
	return err
}

func (c *SSHFileExplorer) Copy(path []string, newPath string, singleFilename string) (err error) {
	for _, target := range path {
		err = c.ExecOnly(fmt.Sprintf("cp -r \"%s\" \"%s/%s\"", normalizePath(target), normalizePath(newPath), singleFilename))
	}
	return err
}

func (c *SSHFileExplorer) Delete(path []string) (err error) {
	for _, target := range path {
		err = c.ExecOnly(fmt.Sprintf("rm --interactive=never -r \"%s\"", normalizePath(target)))
	}
	return err
}

func (c *SSHFileExplorer) Chmod(path []string, code string, recursive bool) (err error) {
	for _, target := range path {
		recurs := ""
		if recursive {
			recurs = "-R"
		}
		err = c.ExecOnly(fmt.Sprintf("chmod %s %s \"%s\"", recurs, code, normalizePath(target)))
	}
	return err
}

func (c *SSHFileExplorer) DownloadFile(srcPath string) ([]byte, error) {
	sftpClient, err := sftp.NewClient(c.client)
	if err != nil {
		return nil, err
	}
	defer sftpClient.Close()

	fileInfo, err := sftpClient.Stat(srcPath)
	if err != nil {
		return nil, err
	}

	if fileInfo.IsDir() {
		return nil, fmt.Errorf("%s is not a file", srcPath)
	}

	fr, err := sftpClient.Open(srcPath)
	if err != nil {
		return nil, err
	}
	defer fr.Close()

	return ioutil.ReadAll(fr)
}

func (c *SSHFileExplorer) UploadFile(destination string, part *multipart.Part) (err error) {
	// Write over SSH StdIn Pipe
	session, err := c.client.NewSession()
	if err != nil {
		return err
	}
	// defer session.Close()

	input, err := session.StdinPipe()
	if err != nil {
		return err
	}

	// Open cat stdin input remotely
	err = session.Start(fmt.Sprintf("cat - > \"%s/%s\"", destination, part.FileName()))
	if err != nil {
		return err
	}

	// Write to Session's Stdin
	if _, err := io.Copy(input, part); err != nil {
		return err
	}
	// Close on finish (Guess it is better to send signal , so for TODO)
	session.Close()

	return err
}

func (c *SSHFileExplorer) Close() error {
	return c.client.Close()
}

// Execute cmd on the remote host and return stderr and stdout
func (c *SSHFileExplorer) Exec(cmd string) ([]byte, error) {
	log.Println(cmd)
	session, err := c.client.NewSession()
	if err != nil {
		return nil, err
	}
	defer session.Close()
	return session.CombinedOutput(cmd)
}

func (c *SSHFileExplorer) ExecOnly(cmd string) error {
	log.Println(cmd)
	session, err := c.client.NewSession()
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
	var results []models.ListDirEntry

	for _, line := range lines {
		if len(line) == 0 {
			continue
		}
		if strings.HasPrefix(line, "total") {
			continue
		}

		if strings.HasPrefix(line, "总用量") {
			continue
		}

		// our Dirty LS Fix with AWK return line as follow:
		// drwxr-xr-x|2|root|root|4096|2016-07-13|17:47|bin
		tmpTokens := strings.SplitN(line, "|", 8)
		var tokens []string
		for _, token := range tmpTokens {
			tokens = append(tokens, strings.TrimSpace(token))
		}
		// fmt.Println(idx, line)
		// fmt.Println(tokens)
		if len(tokens) >= 8 {
			ftype := "file"
			if strings.HasPrefix(tokens[0], "d") {
				ftype = "dir"
			}

			rights := tokens[0]
			if strings.HasPrefix(rights, "l") {
				rights = strings.Replace(rights, "l", "-", 1)
			}
			if strings.HasSuffix(rights, "t") {
				rights = strings.Replace(rights, "t", "-", 1)
			}

			results = append(results, models.ListDirEntry{Name: tokens[7], Rights: rights, Size: tokens[4], Date: tokens[5] + " " + tokens[6] + ":00", Type: ftype})
		}
	}
	return results
}
