package settings

import (
	"log"

	"gopkg.in/ini.v1"
)

var (
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
	Server.Type = global.Key("SERVER").MustString("http")

	// Server Section
	server := Cfg.Section("server." + Server.Type)
	Server.Bind = server.Key("BIND").MustString("localhost:4000")
	Server.Statics = server.Key("STATICS").Strings(",")
	Server.SSLCert = server.Key("SSLCERT").String()
	Server.SSLKey = server.Key("SSLKEY").String()
	Server.CorsOrigins = server.Key("CORSORIGINS").Strings(",")
}
