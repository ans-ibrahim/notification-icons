EXTENSION_NAME = notification-icons@muhammad_ans.github
EXTENSION_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(EXTENSION_NAME)
SCHEMA_DIR = $(EXTENSION_NAME)/schemas
BUILD_DIR = build
ZIP_FILE = $(BUILD_DIR)/$(EXTENSION_NAME).zip

.PHONY: all
all: build install

.PHONY: compile-schemas
compile-schemas:
	@echo "Compiling glib schemas..."
	@glib-compile-schemas $(SCHEMA_DIR)
	@echo "Schemas compiled successfully"

.PHONY: build
build: compile-schemas
	@echo "Building $(EXTENSION_NAME)..."
	@mkdir -p $(BUILD_DIR)
	@rm -f $(ZIP_FILE)
	@cd $(EXTENSION_NAME) && zip -r ../$(ZIP_FILE) . -x "*.DS_Store" "*/.*"
	@echo "Extension built: $(ZIP_FILE)"

.PHONY: install
install: compile-schemas
	@echo "Installing $(EXTENSION_NAME)..."
	@mkdir -p $(EXTENSION_DIR)
	@cp -r $(EXTENSION_NAME)/* $(EXTENSION_DIR)/
	@echo "Extension installed to $(EXTENSION_DIR)"
	