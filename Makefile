EXTENSION_NAME = notification-icons@muhammad_ans.github
EXTENSION_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(EXTENSION_NAME)
SCHEMA_DIR = $(EXTENSION_NAME)/schemas

.PHONY: all
all: install

.PHONY: compile-schemas
compile-schemas:
	@echo "Compiling glib schemas..."
	@glib-compile-schemas $(SCHEMA_DIR)
	@echo "Schemas compiled successfully"

.PHONY: install
install: compile-schemas
	@echo "Installing $(EXTENSION_NAME)..."
	@mkdir -p $(EXTENSION_DIR)
	@cp -r $(EXTENSION_NAME)/* $(EXTENSION_DIR)/
	@echo "Extension installed to $(EXTENSION_DIR)"
	