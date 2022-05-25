package main

import (
	"bytes"
	"fmt"
	"github.com/go-macaron/binding"
	"github.com/go-macaron/cache"
	"github.com/go-macaron/session"
	"github.com/martini-contrib/cors"
	"gofe/fe"
	"gofe/models"
	"gofe/settings"
	"gopkg.in/macaron.v1"
	"io"
	"log"
	"net/http"
	"path"
	"strings"
	"time"
)

var DEFAULT_API_ERROR_RESPONSE = models.GenericResp{Result: models.GenericRespBody{Success: false, Error: "Not Supported by current backend."}}

type SessionInfo struct {
	User         string
	Password     string
	FileExplorer fe.FileExplorer
	Uid          string
}

func Start() {
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
	m.Use(cors.Allow(&cors.Options{
		AllowOrigins:     settings.Server.CorsOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
		AllowHeaders:     []string{"Origin", "X-Requested-With", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	m.Use(session.Sessioner())
	m.Use(macaron.Renderer())
	m.Use(Contexter())

	m.Post("/api/_", binding.Bind(models.GenericReq{}), apiHandler)
	m.Post("/api/list", binding.Bind(models.GenericReq{}), apiHandler)
	m.Get("/", homeHandler)
	m.Get("/login", loginHandler)
	m.Get("/api/download", downloadHandler)
	m.Post("/api/upload", uploadHandler)

	if settings.Server.Type == "http" {
		bind := strings.Split(settings.Server.Bind, ":")
		if len(bind) == 1 {
			m.Run(bind[0])
		}
		if len(bind) == 2 {
			m.Run(bind[0], bind[1])
		}
	} else if settings.Server.Type == "https" {
		log.Fatal(http.ListenAndServeTLS(settings.Server.Bind, settings.Server.SSLCert, settings.Server.SSLKey, m))
	}
}

func homeHandler(ctx *macaron.Context) {
	ctx.HTML(200, "index")
}

func loginHandler(ctx *macaron.Context) {
	ctx.HTML(200, "login")
}

func apiHandler(c *macaron.Context, req models.GenericReq, s SessionInfo) {
	switch req.Action {
	case "list":
		ls, err := s.FileExplorer.ListDir(req.Path)
		if err == nil {
			c.JSON(200, models.ListDirResp{Result: ls})
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "rename":
		err := s.FileExplorer.Rename(req.Item, req.NewItemPath)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "move":
		err := s.FileExplorer.Move(req.Items, req.NewPath)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "copy":
		err := s.FileExplorer.Copy(req.Items, req.NewPath, req.SingleFilename)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "remove":
		err := s.FileExplorer.Delete(req.Items)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "createFolder":
		err := s.FileExplorer.Mkdir(req.NewPath)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "changePermissions":
		err := s.FileExplorer.Chmod(req.Items, req.PermsCode, req.Recursive)
		if err == nil {
			ApiSuccessResponse(c, "")
		} else {
			ApiErrorResponse(c, 400, err)
		}
	case "compress":
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	case "extract":
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	default:
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	}
}

func IsApiPath(url string) bool {
	return strings.HasPrefix(url, "/api/") || strings.HasPrefix(url, "/bridges/php/handler.php")
}

func uploadHandler(c *macaron.Context, req *http.Request, s SessionInfo) {
	if req.Method == "POST" {
		reader, err := req.MultipartReader()
		if err != nil {
			c.JSON(200, models.GenericResp{Result: models.GenericRespBody{Success: false, Error: err.Error()}})
		}
		destination := ""
		for {
			part, err := reader.NextPart()
			if err == io.EOF {
				break
			}

			if part.FormName() == "destination" {
				buf := new(bytes.Buffer)
				buf.ReadFrom(part)
				destination = buf.String()
			}

			if part.FileName() == "" {
				continue
			}

			if len(destination) == 0 {
				continue
			}

			err = s.FileExplorer.UploadFile(destination, part)
			if err != nil {
				c.JSON(200, models.GenericResp{Result: models.GenericRespBody{Success: false, Error: err.Error()}})
			}
		}
		ApiSuccessResponse(c, "")
	} else {
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	}
}

func downloadHandler(c *macaron.Context, req *http.Request, s SessionInfo) {
	if req.Method == "GET" {
		params := req.URL.Query()

		fPath := params.Get("path")
		filename := path.Base(fPath)
		fmt.Println("download file: " + fPath)

		fBytes, err := s.FileExplorer.DownloadFile(fPath)
		if err != nil {
			c.JSON(200, models.GenericResp{Result: models.GenericRespBody{
				Success: false, Error: err.Error()},
			})
		}

		c.Header().Set("content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		http.ServeContent(c, req, filename, time.Now(), bytes.NewReader(fBytes))
	} else {
		c.JSON(200, DEFAULT_API_ERROR_RESPONSE)
	}
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
					fex, err := BackendConnect(username, password)
					if err != nil {
						AuthError(c, f, err)
					} else {
						uid := username // TODO: ??
						sessionInfo = SessionInfo{username, password, fex, uid}
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
	fex := fe.NewSSHFileExplorer(settings.Backend.Host, username, password)
	err := fex.Init()
	if err == nil {
		return fex, nil
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
