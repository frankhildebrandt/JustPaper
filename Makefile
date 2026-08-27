APP := JustPaper
APP_BUNDLE := src-tauri/target/release/bundle/macos/$(APP).app
INSTALL_DIR := /Applications

.PHONY: dev install dmg text test

# Run the app in Tauri development mode.
dev:
	npm run tauri dev

# Build the macOS app and install it into /Applications.
install:
	npm install
	npm run tauri build -- --bundles app
	rm -rf "$(INSTALL_DIR)/$(APP).app"
	cp -R "$(APP_BUNDLE)" "$(INSTALL_DIR)/"

# Build a distributable macOS disk image.
dmg:
	npm run tauri build -- --bundles dmg

# Run the test suite.
text test:
	npm test
