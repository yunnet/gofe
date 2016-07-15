package main

import (
	"fmt"
	"log"
	"runtime"
	"strings"

	"github.com/go-macaron/binding"
	"github.com/go-macaron/cache"
	"github.com/go-macaron/session"
	"github.com/md2k/gofe/fe"
	"github.com/md2k/gofe/models"
	"github.com/md2k/gofe/settings"
	macaron "gopkg.in/macaron.v1"
)

var DEFAULT_API_ERROR_RESPONSE = models.GenericResp{
	models.GenericRespBody{false, "Not Supported"},
}

type SessionInfo struct {
	User         string
	Password     string
	FileExplorer fe.FileExplorer
	Uid          string
}

func main() {
	configRuntime()
	startServer()
}

func configRuntime() {
	numCPU := runtime.NumCPU()
	runtime.GOMAXPROCS(numCPU)
	fmt.Printf("Running with %d CPUs\n", numCPU)
}

func startServer() {
	settings.Load()
	macaron.Classic()
	m := macaron.New()
	m.Use(macaron.Logger())
	m.Use(macaron.Recovery())
	if len(settings.Server.Statics) > 0 {
		m.Use(macaron.Statics(macaron.StaticOptions{
			Prefix:      "static",
			SkipLogging: false,
		}, settings.Server.Statics...))
	}
	m.Use(cache.Cacher())
	m.Use(session.Sessioner())
	m.Use(macaron.Renderer())
	m.Use(Contexter())

	m.Post("/api/_", binding.Bind(models.GenericReq{}), apiHandler)
	m.Post("/bridges/php/handler.php", binding.Bind(models.GenericReq{}), apiHandler)
	m.Get("/", mainHandler)
	m.Get("/login", loginHandler)
	m.Post("/api/download", defaultHandler)
	m.Post("/api/upload", defaultHandler)

	if settings.Server.Type == "http" {
		bind := strings.Split(settings.Server.Bind, ":")
		if len(bind) == 1 {
			m.Run(bind[0])
		}
		if len(bind) == 2 {
			m.Run(bind[0], bind[1])
		}
	}
}

func mainHandler(ctx *macaron.Context) {
	ctx.HTML(200, "index")
}

func loginHandler(ctx *macaron.Context) {
	ctx.HTML(200, "login")
}

func defaultHandler(ctx *macaron.Context) {
	ctx.JSON(200, DEFAULT_API_ERROR_RESPONSE)
}

func apiHandler(c *macaron.Context, req models.GenericReq, s SessionInfo) {
	if req.Action == "list" {
		ls, err := s.FileExplorer.ListDir(req.Path)
		if err == nil {
			c.JSON(200, models.ListDirResp{ls})
		} else {
			ApiErrorResponse(c, 400, err)
		}
	} else if req.Action == "rename" { // path, newPath
		err := s.FileExplorer.Move(req.Path, req.NewPath)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	} else if req.Action == "copy" { // path, newPath
		err := s.FileExplorer.Copy(req.Path, req.NewPath)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	} else if req.Action == "delete" { // path
		err := s.FileExplorer.Delete(req.Path)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	} else if req.Action == "savefile" { // content, path
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	} else if req.Action == "editfile" { // path
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	} else if req.Action == "addfolder" { // name, path
		err := s.FileExplorer.Mkdir(req.Path, req.Name)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	} else if req.Action == "changepermissions" { // path, perms, permsCode, recursive
		err := s.FileExplorer.Chmod(req.Path, req.Perms)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	} else if req.Action == "compress" { // path, destination
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	} else if req.Action == "extract" { // path, destination, sourceFile
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	}
}

func IsApiPath(url string) bool {
	return strings.HasPrefix(url, "/api/") || strings.HasPrefix(url, "/bridges/php/handler.php")
}

func Contexter() macaron.Handler {
	return func(c *macaron.Context, cache cache.Cache, session session.Store, f *session.Flash) {
		isSigned := false
		sessionInfo := SessionInfo{}
		uid := session.Get("uid")

		if uid == nil {
			isSigned = false
		} else {
			sessionInfoObj := cache.Get(uid.(string))
			if sessionInfoObj == nil {
				isSigned = false
			} else {
				sessionInfo = sessionInfoObj.(SessionInfo)
				if sessionInfo.User == "" || sessionInfo.Password == "" {
					isSigned = false
				} else {
					isSigned = true
					c.Data["User"] = sessionInfo.User
					c.Map(sessionInfo)
					if sessionInfo.FileExplorer == nil {
						fe, err := BackendConnect(sessionInfo.User, sessionInfo.Password)
						sessionInfo.FileExplorer = fe
						if err != nil {
							isSigned = false
							if IsApiPath(c.Req.URL.Path) {
								ApiErrorResponse(c, 500, err)
							} else {
								AuthError(c, f, err)
							}
						}
					}
				}
			}
		}

		if isSigned == false {
			if strings.HasPrefix(c.Req.URL.Path, "/login") {
				if c.Req.Method == "POST" {
					username := c.Query("username")
					password := c.Query("password")
					fe, err := BackendConnect(username, password)
					if err != nil {
						AuthError(c, f, err)
					} else {
						uid := username // TODO: ??
						sessionInfo = SessionInfo{username, password, fe, uid}
						cache.Put(uid, sessionInfo, 100000000000)
						session.Set("uid", uid)
						c.Data["User"] = sessionInfo.User
						c.Map(sessionInfo)
						c.Redirect("/")
					}
				}
			} else {
				c.Redirect("/login")
			}
		} else {
			if strings.HasPrefix(c.Req.URL.Path, "/logout") {
				sessionInfo.FileExplorer.Close()
				session.Delete("uid")
				cache.Delete(uid.(string))
				c.SetCookie("MacaronSession", "")
				c.Redirect("/login")
			}
		}
	}
}

func BackendConnect(username string, password string) (fe.FileExplorer, error) {
	fe := fe.NewSSHFileExplorer(settings.Backend.Host, username, password)
	err := fe.Init()
	if err == nil {
		return fe, nil
	}
	log.Println(err)
	return nil, err
}

func ApiErrorResponse(c *macaron.Context, code int, obj interface{}) {
	var message string
	if err, ok := obj.(error); ok {
		message = err.Error()
	} else {
		message = obj.(string)
	}
	c.JSON(code, models.GenericResp{models.GenericRespBody{false, message}})
}

func ApiSuccessResponse(c *macaron.Context, message string) {
	c.JSON(200, models.GenericResp{models.GenericRespBody{true, message}})
}

func AuthError(c *macaron.Context, f *session.Flash, err error) {
	f.Set("ErrorMsg", err.Error())
	c.Data["Flash"] = f
	c.Data["ErrorMsg"] = err.Error()
	c.Redirect("/login")
}
