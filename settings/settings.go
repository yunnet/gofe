package settings

import (
	"log"

	ini "gopkg.in/ini.v1"
)

var (
	Backend struct {
		Type string
		Host string
	}
	Server struct {
		Type        string
		Bind        string
		CorsOrigins []string
		Statics     []string
		SSLCert     string
		SSLKey      string
	}
)

func Load() {
	Cfg, err := ini.Load("gofe.ini")
	if err != nil {
		log.Println(err)
		return
	}

	// Global Section
	global := Cfg.Section("")
	Backend.Type = global.Key("BACKEND").MustString("ssh")
	Server.Type = global.Key("SERVER").MustString("http")

	// Backend Section
	backend := Cfg.Section("backend." + Backend.Type)
	Backend.Host = backend.Key("HOST").MustString("localhost:22")

	// Server Section
	server := Cfg.Section("server." + Server.Type)
	Server.Bind = server.Key("BIND").MustString("localhost:4000")
	Server.Statics = server.Key("STATICS").Strings(",")
	Server.SSLCert = server.Key("SSLCERT").String()
	Server.SSLKey = server.Key("SSLKEY").String()
	Server.CorsOrigins = server.Key("CORSORIGINS").Strings(",")
}
