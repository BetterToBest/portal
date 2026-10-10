// Runs the 41 odd Ed25519 cases (../ed25519-odd-cases.json) through Go's standard library
// (crypto/ed25519) and prints a JSON result to standard output. Evidence only: no verifier in this
// repository uses it. Standard library only, so nothing needs installing:
//   go run run.go > go-results.json
package main

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"
)

type vcase struct {
	Name string `json:"name"`
	Pub  string `json:"pub"`
	Msg  string `json:"msg"`
	Sig  string `json:"sig"`
}

func main() {
	raw, err := os.ReadFile("../ed25519-odd-cases.json")
	if err != nil {
		panic(err)
	}
	var f struct {
		Cases []vcase `json:"cases"`
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		panic(err)
	}
	out := []bool{}
	for _, c := range f.Cases {
		pub, _ := hex.DecodeString(c.Pub)
		sig, _ := hex.DecodeString(c.Sig)
		ok := false
		func() {
			defer func() { _ = recover() }() // a panic counts as "refused"
			ok = ed25519.Verify(ed25519.PublicKey(pub), []byte(c.Msg), sig)
		}()
		out = append(out, ok)
	}
	b, _ := json.Marshal(map[string]any{
		"versions": map[string]string{"Go crypto/ed25519": strings.TrimPrefix(runtime.Version(), "go")},
		"results":  map[string][]bool{"Go crypto/ed25519": out},
	})
	fmt.Println(string(b))
}
